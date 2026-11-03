import { eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./index.ts";
import { sendCounts, sendLimits } from "./schema.ts";

/** Row key for the limits that apply to everyone without an override. */
export const GLOBAL_LIMITS = "*";

export type SendLimits = { perMinute: number | null; perDay: number | null };

/** The default row and this user's override, with the override winning field by field. */
export async function getSendLimits(db: Db, userId: string): Promise<SendLimits> {
  const rows = await db.select().from(sendLimits).where(inArray(sendLimits.userId, [GLOBAL_LIMITS, userId]));
  const global = rows.find((r) => r.userId === GLOBAL_LIMITS);
  const own = rows.find((r) => r.userId === userId);
  return {
    perMinute: own?.perMinute ?? global?.perMinute ?? null,
    perDay: own?.perDay ?? global?.perDay ?? null,
  };
}

/** Sets the default (userId "*") or one user's override. Both null removes an override. */
export async function setSendLimits(db: Db, userId: string, limits: SendLimits) {
  if (userId !== GLOBAL_LIMITS && limits.perMinute == null && limits.perDay == null) {
    await db.delete(sendLimits).where(eq(sendLimits.userId, userId));
    return;
  }
  await db
    .insert(sendLimits)
    .values({ userId, ...limits })
    .onConflictDoUpdate({ target: sendLimits.userId, set: { ...limits, updatedAt: new Date() } });
}

/** Counts one message sent through Malote today (UTC). */
export async function recordSendCount(db: Db, sessionId: string) {
  const day = new Date().toISOString().slice(0, 10);
  await db
    .insert(sendCounts)
    .values({ sessionId, day, count: 1 })
    .onConflictDoUpdate({ target: [sendCounts.sessionId, sendCounts.day], set: { count: sql`${sendCounts.count} + 1` } });
}

/** Used when no limit is set from the admin page. */
export const SEND_LIMIT_DEFAULTS = { perMinute: 10, perDay: 200 } as const;
/** Ceilings the worker enforces whatever the database says. Raising them needs a new, public image. */
export const SEND_LIMIT_CAPS = { perMinute: 30, perDay: 1000 } as const;

/** Fills gaps with the defaults and clamps to [1, cap]. */
export function effectiveSendLimits(l: SendLimits, defaults: { perMinute: number; perDay: number } = SEND_LIMIT_DEFAULTS) {
  const clamp = (v: number | null, d: number, cap: number) => Math.min(cap, Math.max(1, Math.floor(v ?? d)));
  return {
    perMinute: clamp(l.perMinute, defaults.perMinute, SEND_LIMIT_CAPS.perMinute),
    perDay: clamp(l.perDay, defaults.perDay, SEND_LIMIT_CAPS.perDay),
  };
}
