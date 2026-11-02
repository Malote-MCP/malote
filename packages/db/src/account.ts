import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { enqueueCommand, waitForCommand } from "./commands.ts";
import { getSessionByUserId } from "./queries.ts";
import * as schema from "./schema.ts";
import { apiTokens, termsAcceptances, waSessions } from "./schema.ts";

type Db = NodePgDatabase<typeof schema>;

/** Versions of the legal texts published at /termos and /privacidade. Bump when either changes. */
export const TERMS_VERSION = "2026-11-01";
export const PRIVACY_VERSION = "2026-11-02";

export async function hasAcceptedCurrentTerms(db: Db, userId: string) {
  const rows = await db
    .select({ id: termsAcceptances.id })
    .from(termsAcceptances)
    .where(
      sql`${termsAcceptances.userId} = ${userId} and ${termsAcceptances.termsVersion} = ${TERMS_VERSION} and ${termsAcceptances.privacyVersion} = ${PRIVACY_VERSION}`,
    )
    .limit(1);
  return rows.length > 0;
}

export async function acceptCurrentTerms(db: Db, userId: string) {
  await db
    .insert(termsAcceptances)
    .values({ userId, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION })
    .onConflictDoNothing();
}

/**
 * Deletes everything the user has in Malote (Política 12.3, Termos 16.2): the WhatsApp link is logged
 * out first, then the session (messages, chats, contacts, media, keys and WhatsApp credentials cascade
 * from it), tokens, accepted-terms records and the sign-in account itself.
 */
export async function deleteAccount(db: Db, userId: string) {
  const session = await getSessionByUserId(db, userId);
  if (session && (session.enabled || session.status === "connected")) {
    // Unlink the device from the phone; the account is deleted even if the worker doesn't answer in time.
    const id = await enqueueCommand(db, { sessionId: session.id, type: "logout", source: "web" });
    await waitForCommand(db, id, 15_000).catch(() => {});
  }
  await db.transaction(async (tx) => {
    await tx.delete(waSessions).where(eq(waSessions.userId, userId));
    await tx.delete(apiTokens).where(eq(apiTokens.userId, userId));
    await tx.delete(termsAcceptances).where(eq(termsAcceptances.userId, userId));
    // Neon Auth's own tables; sessions and linked Google accounts cascade from the user row.
    await tx.execute(sql`delete from neon_auth."user" where id = ${userId}`);
  });
}
