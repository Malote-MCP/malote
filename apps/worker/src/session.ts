import {
  encEpochs,
  getChat,
  mediaFiles,
  newEpoch,
  Sealer,
  waSessions,
  type Db,
  type DownloadMediaPayload,
  type QuotedPayload,
  type SendFilePayload,
} from "@malote/db";
import makeWASocket, {
  Browsers,
  BufferJSON,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  isJidGroup,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  type AnyMessageContent,
  type WAMessage,
  type WASocket,
} from "baileys";
import { and, eq } from "drizzle-orm";
import type { Logger } from "pino";
import { usePostgresAuthState } from "./auth-state.ts";
import { chatJidOf, setChatName, storeChats, storeContacts, storeMessages } from "./ingest.ts";
import { checkSendAllowed, recordSend } from "./policy.ts";

type Boom = Error & { output?: { statusCode?: number } };

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
// A new encryption epoch (ephemeral key) at least this often.
const EPOCH_MAX_AGE_MS = 24 * 3600_000;

let versionPromise: ReturnType<typeof fetchLatestBaileysVersion> | null = null;
function waVersion() {
  versionPromise ??= fetchLatestBaileysVersion().catch(() => ({ version: undefined, isLatest: false }) as never);
  return versionPromise;
}

type SessionRow = typeof waSessions.$inferSelect;

/** Owns one WhatsApp socket for one Malote user. */
export class SessionRunner {
  sock: WASocket | null = null;
  status: "starting" | "qr" | "connected" | "stopped" = "starting";
  selfJid: string | null = null;
  selfLid: string | null = null;
  private attempts = 0;
  private stopped = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private recentSent = new Map<string, WAMessage>();
  private namedGroups = new Set<string>();
  private sealerCache: Sealer | null = null;
  private log: Logger;

  constructor(
    readonly db: Db,
    public session: SessionRow,
    logger: Logger,
    private egressIp: string | null,
  ) {
    this.log = logger.child({ session: session.id });
  }

  get id() {
    return this.session.id;
  }

  private async update(values: Partial<SessionRow>) {
    Object.assign(this.session, values);
    await this.db
      .update(waSessions)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(waSessions.id, this.session.id));
  }

  /** Encrypts to the user's public key; null until the user has created a key (then nothing is stored). */
  async sealer() {
    const publicKey = this.session.publicKey;
    if (!publicKey) return null;
    if (this.sealerCache && Date.now() - this.sealerCache.createdAt < EPOCH_MAX_AGE_MS) return this.sealerCache;
    const { epk, key } = newEpoch(publicKey);
    const [epoch] = await this.db.insert(encEpochs).values({ sessionId: this.id, epk }).returning({ id: encEpochs.id });
    this.sealerCache = new Sealer(epoch.id, key);
    return this.sealerCache;
  }

  /** The user created or reset their key: reload it and start a new epoch. */
  async rekey() {
    const [row] = await this.db.select().from(waSessions).where(eq(waSessions.id, this.id)).limit(1);
    if (row) this.session.publicKey = row.publicKey;
    this.sealerCache = null;
    this.namedGroups.clear();
    return this.sealer();
  }

  async start() {
    this.stopped = false;
    const auth = await usePostgresAuthState(this.db, this.session.id);
    const { version } = await waVersion();
    const baileysLogger = this.log.child({ mod: "baileys" });
    baileysLogger.level = "warn";

    const sock = makeWASocket({
      version,
      auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, baileysLogger) },
      logger: baileysLogger,
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async (key) => this.recentSent.get(key.id ?? "")?.message ?? undefined,
    });
    this.sock = sock;

    await this.update({ workerId: process.env.FLY_MACHINE_ID ?? null, egressIp: this.egressIp, lastError: null });

    sock.ev.on("creds.update", () => void auth.saveCreds().catch((e) => this.log.error(e, "saveCreds failed")));

    sock.ev.on("connection.update", async (u) => {
      try {
        if (u.qr) {
          this.status = "qr";
          await this.update({ status: "qr", qr: u.qr, qrUpdatedAt: new Date() });
        }
        if (u.connection === "open") {
          this.attempts = 0;
          this.status = "connected";
          this.selfJid = sock.user?.id ? jidNormalizedUser(sock.user.id) : null;
          this.selfLid = sock.user?.lid ? jidNormalizedUser(sock.user.lid) : null;
          await this.update({
            status: "connected",
            qr: null,
            phone: this.selfJid?.split("@")[0] ?? null,
            waJid: this.selfJid,
            waLid: this.selfLid,
            pushName: sock.user?.name ?? sock.user?.notify ?? null,
            lastSeenAt: new Date(),
            lastError: null,
          });
          this.log.info({ jid: this.selfJid }, "connected");
        }
        if (u.connection === "close") await this.handleClose(u.lastDisconnect?.error as Boom | undefined, auth.clear);
      } catch (e) {
        this.log.error(e, "connection.update handler failed");
      }
    });

    sock.ev.on("messaging-history.set", async ({ chats, contacts, messages }) => {
      try {
        const s = await this.sealer();
        await storeChats(this.db, this.id, chats, s);
        await storeContacts(this.db, this.id, contacts, s);
        await storeMessages(this.db, this.id, messages, s);
        this.log.info({ chats: chats.length, contacts: contacts.length, messages: messages.length }, "history sync chunk");
      } catch (e) {
        this.log.error(e, "history sync store failed");
      }
    });
    const withSealer = (fn: (s: Sealer | null) => Promise<unknown>) =>
      void this.sealer()
        .then(fn)
        .catch((e) => this.log.error(e));
    sock.ev.on("chats.upsert", (c) => withSealer((s) => storeChats(this.db, this.id, c, s)));
    sock.ev.on("chats.update", (c) => withSealer((s) => storeChats(this.db, this.id, c, s)));
    sock.ev.on("contacts.upsert", (c) => withSealer((s) => storeContacts(this.db, this.id, c, s)));
    sock.ev.on("contacts.update", (c) => withSealer((s) => storeContacts(this.db, this.id, c, s)));
    sock.ev.on("groups.upsert", (groups) => {
      for (const g of groups) if (g.subject) withSealer((s) => setChatName(this.db, this.id, g.id, g.subject, s));
    });
    sock.ev.on("groups.update", (groups) => {
      for (const g of groups) if (g.id && g.subject) withSealer((s) => setChatName(this.db, this.id, g.id!, g.subject!, s));
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const rows = await storeMessages(this.db, this.id, messages, await this.sealer());
        for (const r of rows) if (r.chatJid && isJidGroup(r.chatJid)) void this.ensureGroupName(r.chatJid);
      } catch (e) {
        this.log.error(e, "messages.upsert store failed");
      }
    });
    sock.ev.on("messages.update", async (updates) => {
      // Edits arrive as protocol messages via upsert; here we only care about deletions for everyone.
      for (const u of updates) {
        if (u.update.message === null && u.key.id && u.key.remoteJid) {
          await storeMessages(
            this.db,
            this.id,
            [
              {
                key: { remoteJid: u.key.remoteJid, fromMe: u.key.fromMe, id: `revoke-${u.key.id}` },
                message: { protocolMessage: { type: 0, key: u.key } },
              } as WAMessage,
            ],
            await this.sealer(),
          ).catch(() => {});
        }
      }
    });
  }

  private async ensureGroupName(jid: string) {
    if (this.namedGroups.has(jid) || !this.sock) return;
    this.namedGroups.add(jid);
    const chat = await getChat(this.db, this.id, jid);
    if (chat?.name) return;
    try {
      const meta = await this.sock.groupMetadata(jid);
      if (meta.subject) await setChatName(this.db, this.id, jid, meta.subject, await this.sealer());
    } catch (e) {
      this.log.debug(e, "groupMetadata failed");
    }
  }

  private async handleClose(err: Boom | undefined, clearAuth: () => Promise<unknown>) {
    const code = err?.output?.statusCode;
    this.sock = null;
    if (this.stopped) return;
    this.log.warn({ code, msg: err?.message }, "connection closed");

    if (code === DisconnectReason.loggedOut) {
      await clearAuth();
      this.status = "stopped";
      await this.update({ status: "logged_out", enabled: false, qr: null, lastError: "Sessão encerrada pelo WhatsApp (logout)." });
      return;
    }
    if (code === DisconnectReason.forbidden) {
      this.status = "stopped";
      await this.update({ status: "error", enabled: false, qr: null, lastError: "WhatsApp recusou a conexão (403). Possível bloqueio da conta." });
      return;
    }
    if (code === DisconnectReason.connectionReplaced) {
      this.status = "stopped";
      await this.update({ status: "error", qr: null, lastError: "Conexão substituída por outra sessão." });
      return;
    }
    // QR expired without being scanned: stop and let the user ask for a new one.
    if (this.status === "qr" && !this.session.waJid && code === DisconnectReason.timedOut) {
      this.status = "stopped";
      await this.update({ status: "pending", enabled: false, qr: null, lastError: "QR code expirou. Gere um novo." });
      return;
    }
    if (code === DisconnectReason.restartRequired) {
      void this.start();
      return;
    }
    // Exponential backoff with jitter; never hammer WhatsApp with reconnects.
    const delay = Math.min(60_000, 1000 * 2 ** this.attempts) + Math.random() * 1000;
    this.attempts++;
    this.reconnectTimer = setTimeout(() => void this.start().catch((e) => this.log.error(e, "restart failed")), delay);
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.sock?.end(undefined);
    this.sock = null;
    this.status = "stopped";
  }

  async logout() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    try {
      await this.sock?.logout();
    } catch {
      // ignore — we clear local state anyway
    }
    this.sock = null;
    this.status = "stopped";
    const auth = await usePostgresAuthState(this.db, this.id);
    await auth.clear();
    await this.update({ status: "logged_out", enabled: false, qr: null, waJid: null, waLid: null, phone: null });
  }

  async heartbeat() {
    if (this.status === "connected") await this.update({ lastSeenAt: new Date() });
  }

  private requireSock() {
    if (!this.sock || this.status !== "connected") throw new Error("WhatsApp não está conectado.");
    return this.sock;
  }

  /** Resolves 'me'/'self' to the user's own chat. */
  resolveJid(jid: string) {
    if (jid === "me" || jid === "self") {
      if (!this.selfJid) throw new Error("WhatsApp não está conectado.");
      return this.selfJid;
    }
    return jid.includes("@") ? jid : `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
  }

  isSelf(jid: string) {
    return jid === this.selfJid || jid === this.selfLid;
  }

  private async deliver(jid: string, content: AnyMessageContent, opts: { quoted?: WAMessage } = {}) {
    const sock = this.requireSock();
    const chatJid = this.resolveJid(jid);
    if (!this.isSelf(chatJid)) {
      const known = await getChat(this.db, this.id, chatJid);
      await checkSendAllowed(this.id, { knownChat: !!known });
    } else {
      await checkSendAllowed(this.id, { knownChat: true });
    }
    // Behave like a person: show "typing…" briefly before sending.
    await sock.sendPresenceUpdate("composing", chatJid).catch(() => {});
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    const sent = await sock.sendMessage(chatJid, content, opts.quoted ? { quoted: opts.quoted } : undefined);
    await sock.sendPresenceUpdate("paused", chatJid).catch(() => {});
    recordSend(this.id);
    if (sent?.key.id) {
      this.recentSent.set(sent.key.id, sent);
      if (this.recentSent.size > 500) this.recentSent.delete(this.recentSent.keys().next().value!);
      await storeMessages(this.db, this.id, [sent], await this.sealer()).catch(() => {});
    }
    return { messageId: sent?.key.id ?? null, chatJid };
  }

  async sendText(jid: string, text: string, opts: { quoted?: QuotedPayload } = {}) {
    const q = opts.quoted;
    const quoted = !q
      ? undefined
      : q.raw
        ? (JSON.parse(q.raw, BufferJSON.reviver) as WAMessage)
        : ({
            key: { remoteJid: this.resolveJid(jid), id: q.id, fromMe: q.fromMe, participant: q.senderJid ?? undefined },
            message: { conversation: q.text ?? "" },
          } as WAMessage);
    return this.deliver(jid, { text }, { quoted });
  }

  async sendFile(payload: SendFilePayload) {
    const data = Buffer.from(payload.base64, "base64");
    const { mimetype, fileName } = payload;
    if (data.length > MAX_MEDIA_BYTES) throw new Error("Arquivo maior que 25 MB.");

    const caption = payload.caption;
    let content: AnyMessageContent;
    if (mimetype.startsWith("image/") && mimetype !== "image/webp") content = { image: data, mimetype, caption };
    else if (mimetype.startsWith("video/")) content = { video: data, mimetype, caption };
    else if (mimetype.startsWith("audio/")) content = { audio: data, mimetype };
    else content = { document: data, mimetype, fileName: fileName ?? "arquivo", caption };
    return this.deliver(payload.chatJid, content);
  }

  /** Downloads a message's media (the web app passes the decrypted message) and stores it encrypted. */
  async downloadMedia(p: DownloadMediaPayload) {
    const sock = this.requireSock();
    const jid = this.resolveJid(p.chatJid);
    const [cached] = await this.db
      .select({ id: mediaFiles.id, size: mediaFiles.size })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.sessionId, this.id), eq(mediaFiles.chatJid, jid), eq(mediaFiles.messageId, p.messageId)))
      .limit(1);
    if (cached) return { mediaId: cached.id, size: cached.size };

    const s = await this.sealer();
    if (!s) throw new Error("Crie seu token no painel antes de baixar mídias.");
    if (p.size > MAX_MEDIA_BYTES) throw new Error("Mídia maior que 25 MB.");
    const msg = JSON.parse(p.raw, BufferJSON.reviver) as WAMessage;
    const data = await downloadMediaMessage(msg, "buffer", {}, { logger: this.log as never, reuploadRequest: sock.updateMediaMessage });
    if (data.length > MAX_MEDIA_BYTES) throw new Error("Mídia maior que 25 MB.");
    const [file] = await this.db
      .insert(mediaFiles)
      .values({
        sessionId: this.id,
        chatJid: jid,
        messageId: p.messageId,
        mimetype: p.mimetype,
        size: data.length,
        data: s.sealBytes(data),
        epochId: s.epochId,
      })
      .returning({ id: mediaFiles.id });
    return { mediaId: file.id, size: data.length };
  }

  chatJidOf = chatJidOf;
}
