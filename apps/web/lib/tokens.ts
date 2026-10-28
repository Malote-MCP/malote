import { apiTokens } from "@malote/db";
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

const PREFIX = "mlt_";

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createToken(userId: string, name: string) {
  const token = PREFIX + randomBytes(24).toString("base64url");
  const [row] = await db
    .insert(apiTokens)
    .values({ userId, name, tokenHash: hashToken(token), prefix: token.slice(0, 10) })
    .returning({ id: apiTokens.id });
  return { id: row.id, token };
}

/** Returns the owning user id for a valid, non-revoked token. */
export async function verifyToken(token: string) {
  if (!token.startsWith(PREFIX)) return null;
  const [row] = await db
    .select({ id: apiTokens.id, userId: apiTokens.userId })
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hashToken(token)), isNull(apiTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  void db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.id)).catch(() => {});
  return row;
}
