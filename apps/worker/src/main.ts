import {
  COMMANDS_CHANNEL,
  commands,
  createDb,
  createPool,
  waSessions,
  workers,
  type DownloadMediaPayload,
  type SendFilePayload,
  type SendTextPayload,
} from "@malote/db";
import { eq, sql } from "drizzle-orm";
import pg from "pg";
import pino from "pino";
import { env } from "./env.ts";
import { encryptLegacy } from "./legacy.ts";
import { PolicyError } from "./policy.ts";
import { SessionRunner } from "./session.ts";

const log = pino({ level: env.logLevel });
const pool = createPool(env.databaseUrl, 10);
const db = createDb(pool);
const runners = new Map<string, SessionRunner>();

// Commands older than this are expired instead of executed (never send something stale).
const COMMAND_TTL_MS = 2 * 60_000;

async function detectEgressIp() {
  try {
    const res = await fetch("https://api.ipify.org", { signal: AbortSignal.timeout(5000) });
    return (await res.text()).trim();
  } catch {
    return null;
  }
}

const egressIp = await detectEgressIp();
log.info({ egressIp, workerId: env.workerId }, "worker starting");

// Publish which image this worker runs (shown on /api/transparency).
const startedAt = new Date();
async function reportWorker() {
  const values = { imageRef: process.env.FLY_IMAGE_REF ?? null, gitSha: process.env.GIT_SHA ?? null, seenAt: new Date() };
  await db
    .insert(workers)
    .values({ id: env.workerId, startedAt, ...values })
    .onConflictDoUpdate({ target: workers.id, set: { startedAt, ...values } });
}
await reportWorker().catch((e) => log.warn(e, "worker report failed"));

/** Encrypts any plaintext left from before the user had a key. */
async function migrateLegacy(runner: SessionRunner) {
  const s = await runner.sealer();
  if (!s) return;
  const n = await encryptLegacy(pool, runner.id, s);
  if (n) log.info({ session: runner.id, rows: n }, "encrypted legacy rows");
}

async function startSession(sessionId: string) {
  const existing = runners.get(sessionId);
  if (existing && existing.status !== "stopped") return existing;
  const [session] = await db.select().from(waSessions).where(eq(waSessions.id, sessionId)).limit(1);
  if (!session) throw new Error("Sessão não encontrada.");
  const runner = new SessionRunner(db, session, log, egressIp);
  runners.set(sessionId, runner);
  await runner.start();
  void migrateLegacy(runner).catch((e) => log.error(e, "legacy encryption failed"));
  return runner;
}

function connectedRunner(sessionId: string) {
  const runner = runners.get(sessionId);
  if (!runner || runner.status !== "connected") throw new Error("WhatsApp não está conectado.");
  return runner;
}

type CommandRow = typeof commands.$inferSelect;

async function execute(cmd: CommandRow): Promise<unknown> {
  switch (cmd.type) {
    case "connect": {
      const running = runners.get(cmd.sessionId);
      if (running && running.status !== "stopped") {
        // Already connecting or connected: don't clobber the live status/QR.
        await db.update(waSessions).set({ enabled: true }).where(eq(waSessions.id, cmd.sessionId));
        return { ok: true, alreadyRunning: true };
      }
      await db.update(waSessions).set({ enabled: true, status: "pending", lastError: null }).where(eq(waSessions.id, cmd.sessionId));
      await startSession(cmd.sessionId);
      return { ok: true };
    }
    case "logout": {
      const runner = runners.get(cmd.sessionId);
      if (runner) {
        await runner.logout();
        runners.delete(cmd.sessionId);
      } else {
        await db
          .update(waSessions)
          .set({ enabled: false, status: "logged_out", qr: null })
          .where(eq(waSessions.id, cmd.sessionId));
      }
      return { ok: true };
    }
    case "rekey": {
      const runner = runners.get(cmd.sessionId);
      if (runner) {
        await runner.rekey();
        void migrateLegacy(runner).catch((e) => log.error(e, "legacy encryption failed"));
      }
      return { ok: true };
    }
    case "send_text": {
      const p = cmd.payload as SendTextPayload;
      return connectedRunner(cmd.sessionId).sendText(p.chatJid, p.text, { quoted: p.quoted });
    }
    case "send_file":
      return connectedRunner(cmd.sessionId).sendFile(cmd.payload as SendFilePayload);
    case "download_media":
      return connectedRunner(cmd.sessionId).downloadMedia(cmd.payload as DownloadMediaPayload);
    default:
      throw new Error(`Comando desconhecido: ${cmd.type}`);
  }
}

let draining = false;
let drainAgain = false;

/** Claims pending commands (SKIP LOCKED makes this safe with several workers) and runs them. */
async function drain() {
  if (draining) {
    drainAgain = true;
    return;
  }
  draining = true;
  try {
    do {
      drainAgain = false;
      await db.execute(sql`
        update commands set status = 'error', error = 'Comando expirou antes de ser executado.', payload = '{}', finished_at = now()
        where status = 'pending' and created_at < now() - make_interval(secs => ${COMMAND_TTL_MS / 1000})`);
      // Results are read (and deleted) by the web app right away; drop whatever is left.
      await db.execute(sql`delete from commands where finished_at < now() - interval '5 minutes'`);
      const { rows } = await pool.query<{ id: number }>(`
        update commands set status = 'running'
        where id in (select id from commands where status = 'pending' order by id limit 20 for update skip locked)
        returning id`);
      for (const { id } of rows) {
        const [cmd] = await db.select().from(commands).where(eq(commands.id, id));
        void execute(cmd)
          .then((result) =>
            db
              .update(commands)
              .set({ status: "done", payload: {}, result: result ?? {}, finishedAt: new Date() })
              .where(eq(commands.id, id)),
          )
          .catch((e: Error) => {
            if (!(e instanceof PolicyError)) log.warn({ err: e, cmd: cmd.type }, "command failed");
            return db
              .update(commands)
              .set({ status: "error", payload: {}, error: e.message, finishedAt: new Date() })
              .where(eq(commands.id, id));
          });
      }
      if (rows.length === 20) drainAgain = true;
    } while (drainAgain);
  } catch (e) {
    log.error(e, "drain failed");
  } finally {
    draining = false;
  }
}

async function listen() {
  const client = new pg.Client({ connectionString: env.databaseUrlUnpooled });
  client.on("notification", () => void drain());
  client.on("error", (e) => {
    log.error(e, "listen connection error; reconnecting");
    setTimeout(() => void listen(), 2000);
  });
  await client.connect();
  await client.query(`listen ${COMMANDS_CHANNEL}`);
  log.info("listening for commands");
}

// Boot: resume enabled sessions slowly so reconnects never arrive as a burst.
const enabled = await db.select({ id: waSessions.id }).from(waSessions).where(eq(waSessions.enabled, true));
await listen();
void drain();
setInterval(() => void drain(), 5000);
setInterval(() => {
  for (const r of runners.values()) void r.heartbeat().catch(() => {});
  void reportWorker().catch(() => {});
}, 60_000);

for (const [i, s] of enabled.entries()) {
  setTimeout(() => void startSession(s.id).catch((e) => log.error(e, "session start failed")), i * 3000);
}
log.info({ sessions: enabled.length }, "resuming sessions");

async function shutdown() {
  log.info("shutting down");
  await Promise.all([...runners.values()].map((r) => r.stop()));
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
