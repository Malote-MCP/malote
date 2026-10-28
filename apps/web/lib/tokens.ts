import {
  apiTokens,
  chats,
  contacts,
  encEpochs,
  enqueueCommand,
  generateUserKeyPair,
  mediaFiles,
  messages,
  unwrapPrivateKey,
  waSessions,
  wrapPrivateKey,
} from "@malote/db";
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getOrCreateWaSession } from "@/lib/session";

const PREFIX = "mlt_";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class NeedsAuthorization extends Error {}

async function findToken(token: string) {
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
 * - reset: a new key pair; everything encrypted with the old one is deleted and old tokens are revoked.
 */
export async function createToken(userId: string, name: string, opts: { authorizeWith?: string; reset?: boolean } = {}) {
  const session = await getOrCreateWaSession(userId);
  const token = PREFIX + randomBytes(24).toString("base64url");
  let privateKey: string;
  let rekey = false;

  if (session.publicKey && !opts.reset) {
    const existing = opts.authorizeWith ? await findToken(opts.authorizeWith.trim()) : null;
    if (!existing || existing.userId !== userId || !existing.wrappedKey) throw new NeedsAuthorization();
    privateKey = unwrapPrivateKey(existing.wrappedKey, opts.authorizeWith!.trim());
  } else {
    const pair = generateUserKeyPair();
    privateKey = pair.privateKey;
    rekey = true;
    await db.transaction(async (tx) => {
      if (session.publicKey) {
        // Reset: the old key is gone, so is everything encrypted with it.
        await tx.delete(messages).where(eq(messages.sessionId, session.id));
        await tx.delete(mediaFiles).where(eq(mediaFiles.sessionId, session.id));
        await tx.delete(encEpochs).where(eq(encEpochs.sessionId, session.id));
        await tx.update(chats).set({ name: null }).where(eq(chats.sessionId, session.id));
        await tx.update(contacts).set({ name: null, notify: null }).where(eq(contacts.sessionId, session.id));
      }
      // Tokens without (or with the old) key can no longer read anything.
      await tx.update(apiTokens).set({ revokedAt: new Date(), wrappedKey: null }).where(and(eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)));
      await tx.update(waSessions).set({ publicKey: pair.publicKey, updatedAt: new Date() }).where(eq(waSessions.id, session.id));
    });
  }

  const [row] = await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash: hashToken(token), prefix: token.slice(0, 10), wrappedKey: wrapPrivateKey(privateKey, token) })
    .returning({ id: apiTokens.id });
  if (rekey) await enqueueCommand(db, { sessionId: session.id, type: "rekey", source: "web" });
  return { id: row.id, token };
}

/** Returns the owning user and their unwrapped private key for a valid, non-revoked token. */
export async function verifyToken(token: string) {
  const row = await findToken(token);
  if (!row) return null;
  void db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).catch(() => {});
  return { id: row.id, userId: row.userId, privateKey: row.wrappedKey ? unwrapPrivateKey(row.wrappedKey, token) : null };
}
