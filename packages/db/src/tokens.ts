import { and, desc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { createHash, randomBytes } from "node:crypto";
import { enqueueCommand } from "./commands.ts";
import { generateUserKeyPair, unwrapPrivateKey, wrapPrivateKey } from "./crypto.ts";
import { getSessionByUserId } from "./queries.ts";
import * as schema from "./schema.ts";
import { apiTokens, chats, contacts, encEpochs, mediaFiles, messages, waAuth, waSessions } from "./schema.ts";

type Db = NodePgDatabase<typeof schema>;

const PREFIX = "mlt_";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class NeedsAuthorization extends Error {}

/** Each Malote user has exactly one WhatsApp session row; create it lazily. */
export async function getOrCreateWaSession(db: Db, userId: string) {
  const existing = await getSessionByUserId(db, userId);
  if (existing) return existing;
  await db.insert(waSessions).values({ userId }).onConflictDoNothing();
  return (await getSessionByUserId(db, userId))!;
}

async function findToken(db: Db, token: string) {
  if (!token.startsWith(PREFIX)) return null;
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId, wrappedKey: apiTokens.wrappedKey })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Creates an MCP token. The token is also what unlocks the user's private key, so:
 * - first token: a new key pair is generated (and any plaintext history gets encrypted by the worker);
 * - more tokens: an existing token must be presented to unwrap the key and wrap it again;
 * - reset: a new key pair; everything encrypted with the old one is deleted, old tokens are revoked,
 *   and WhatsApp is disconnected. Whoever resets a key cannot read new messages without scanning a
 *   fresh QR code with the account owner's phone.
 */
export async function createToken(
  db: Db,
  userId: string,
  name: string,
  opts: { authorizeWith?: string; reset?: boolean } = {},
) {
  const session = await getOrCreateWaSession(db, userId);
  const token = PREFIX + randomBytes(24).toString("base64url");
  let privateKey: string;
  let rekey = false;
  let logout = false;

  if (session.publicKey && !opts.reset) {
    const presented = opts.authorizeWith?.trim();
    const existing = presented ? await findToken(db, presented) : null;
    if (!existing || existing.userId !== userId || !existing.wrappedKey) throw new NeedsAuthorization();
    privateKey = unwrapPrivateKey(existing.wrappedKey, presented!);
  } else {
    const pair = generateUserKeyPair();
    privateKey = pair.privateKey;
    rekey = true;
    logout = !!session.publicKey;
    await db.transaction(async (tx) => {
      if (session.publicKey) {
        // Reset: the old key is gone, so is everything encrypted with it, and so is the WhatsApp link.
        await tx.delete(messages).where(eq(messages.sessionId, session.id));
        await tx.delete(mediaFiles).where(eq(mediaFiles.sessionId, session.id));
        await tx.delete(encEpochs).where(eq(encEpochs.sessionId, session.id));
        await tx.update(chats).set({ name: null }).where(eq(chats.sessionId, session.id));
        await tx.update(contacts).set({ name: null, notify: null }).where(eq(contacts.sessionId, session.id));
        await tx.delete(waAuth).where(eq(waAuth.sessionId, session.id));
        await tx
          .update(waSessions)
          .set({ enabled: false, status: "logged_out", qr: null, waJid: null, waLid: null, phone: null })
          .where(eq(waSessions.id, session.id));
      }
      // Tokens without (or with the old) key can no longer read anything.
      await tx
        .update(apiTokens)
        .set({ revokedAt: new Date(), wrappedKey: null })
        .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
      await tx.update(waSessions).set({ publicKey: pair.publicKey, updatedAt: new Date() }).where(eq(waSessions.id, session.id));
    });
  }

  const [row] = await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash: hashToken(token), prefix: token.slice(0, 10), wrappedKey: wrapPrivateKey(privateKey, token) })
    .returning({ id: apiTokens.id });
  if (logout) await enqueueCommand(db, { sessionId: session.id, type: "logout", source: "web" });
  if (rekey) await enqueueCommand(db, { sessionId: session.id, type: "rekey", source: "web" });
  return { id: row.id, token };
}

/** Returns the owning user and their unwrapped private key for a valid, non-revoked token. */
export async function verifyToken(db: Db, token: string) {
  const row = await findToken(db, token);
  if (!row) return null;
  void db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).catch(() => {});
  return { id: row.id, userId: row.userId, privateKey: row.wrappedKey ? unwrapPrivateKey(row.wrappedKey, token) : null };
}

export async function listTokens(db: Db, userId: string) {
  const rows = await db
    .select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));
  const session = await getSessionByUserId(db, userId);
  return { tokens: rows, hasKey: !!session?.publicKey };
}

export async function revokeToken(db: Db, userId: string, id: string) {
  // Dropping the wrapped key makes the revoked token useless even if it leaks later.
  await db
    .update(apiTokens)
    .set({ revokedAt: new Date(), wrappedKey: null })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}
