/**
 * Plans, trial, referrals and access. The web app writes here (sign-up, checkout, Asaas webhooks,
 * admin); the worker only calls hasAccess() before serving MCP.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "./index.ts";
import { billing, referrals, waSessions } from "./schema.ts";

export const TRIAL_DAYS = 15;
export const REFERRAL_BONUS_DAYS = 15;
/** Days of access kept after a period ends, so a Pix paid a little late doesn't cut anyone off. */
export const GRACE_DAYS = 3;

export const PLANS = {
  monthly: { label: "Mensal", value: 29.9, cycle: "MONTHLY", months: 1 },
  yearly: { label: "Anual", value: 299, cycle: "YEARLY", months: 12 },
} as const;
export type PlanId = keyof typeof PLANS;
export const isPlan = (p: unknown): p is PlanId => p === "monthly" || p === "yearly";

export type BillingRow = typeof billing.$inferSelect;

const DAY = 86400_000;
const newCode = () => randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8).toLowerCase();

function accessUntilOf(r: Pick<BillingRow, "trialEndsAt" | "paidUntil" | "bonusDays">) {
  const base = Math.max(r.trialEndsAt.getTime(), r.paidUntil?.getTime() ?? 0);
  return new Date(base + r.bonusDays * DAY);
}

export function hasAccessRow(r: BillingRow | undefined | null, now = new Date()) {
  if (!r) return false;
  return r.freeForever || (r.accessUntil != null && r.accessUntil > now);
}

/** Recomputes access_until after any change to trial, payment or bonus. */
async function refresh(db: Db, userId: string) {
  const [r] = await db.select().from(billing).where(eq(billing.userId, userId));
  if (!r) return null;
  const accessUntil = accessUntilOf(r);
  const [u] = await db.update(billing).set({ accessUntil, updatedAt: new Date() }).where(eq(billing.userId, userId)).returning();
  return u;
}

/**
 * The user's billing row, created on first visit with a fresh trial. `referralCode` (from the
 * sign-up link) is only honoured on creation and never for the user's own code.
 */
export async function ensureBilling(db: Db, userId: string, referralCode?: string | null): Promise<BillingRow> {
  const [existing] = await db.select().from(billing).where(eq(billing.userId, userId));
  if (existing) return existing;
  let referredBy: string | null = null;
  if (referralCode) {
    const [ref] = await db.select({ userId: billing.userId }).from(billing).where(eq(billing.referralCode, referralCode.toLowerCase()));
    if (ref && ref.userId !== userId) referredBy = ref.userId;
  }
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * DAY);
  for (let attempt = 0; ; attempt++) {
    try {
      const [row] = await db
        .insert(billing)
        .values({ userId, trialEndsAt, accessUntil: trialEndsAt, referralCode: newCode(), referredBy })
        .onConflictDoNothing({ target: billing.userId })
        .returning();
      if (referredBy && row) {
        await db.insert(referrals).values({ referredUserId: userId, referrerUserId: referredBy }).onConflictDoNothing();
      }
      return row ?? (await db.select().from(billing).where(eq(billing.userId, userId)))[0];
    } catch (e) {
      // Referral code collision: try another code.
      if (attempt < 3 && String((e as Error).message).includes("billing_referral_code_idx")) continue;
      throw e;
    }
  }
}

/** What the worker checks before serving MCP. Users without a row have not opened the panel yet. */
export async function hasAccess(db: Db, userId: string) {
  const [r] = await db.select().from(billing).where(eq(billing.userId, userId));
  return hasAccessRow(r);
}

/**
 * Pays out referrals whose referred user has connected a WhatsApp number. A number counts once,
 * and never the referrer's own: a fake e-mail is free, a real WhatsApp number is not.
 */
/**
 * Referrals keep only a hash of the phone number (no device suffix), so a number can be paid out once
 * even after the referred account is deleted, without Malote keeping the number itself.
 */
export const referralNumberHash = (waJid: string) =>
  createHash("sha256").update(`malote-referral:${waJid.split(/[:@]/)[0]}`).digest("hex");

export async function rewardReferrals(db: Db, referrerUserId: string) {
  const [own] = await db.select({ waJid: waSessions.waJid }).from(waSessions).where(eq(waSessions.userId, referrerUserId));
  const pending = await db
    .select({ referredUserId: referrals.referredUserId, waJid: waSessions.waJid })
    .from(referrals)
    .innerJoin(waSessions, eq(waSessions.userId, referrals.referredUserId))
    .where(and(eq(referrals.referrerUserId, referrerUserId), isNull(referrals.rewardedAt), sql`${waSessions.waJid} is not null`));
  let rewarded = 0;
  for (const p of pending) {
    if (!p.waJid || (own?.waJid && referralNumberHash(p.waJid) === referralNumberHash(own.waJid))) continue;
    const done = await db
      .update(referrals)
      .set({ waJid: referralNumberHash(p.waJid), rewardedAt: new Date() })
      .where(and(eq(referrals.referredUserId, p.referredUserId), isNull(referrals.rewardedAt)))
      .returning()
      .catch(() => []); // the number already paid out a referral (unique wa_jid)
    if (done.length) rewarded++;
  }
  if (rewarded) {
    await db
      .update(billing)
      .set({ bonusDays: sql`${billing.bonusDays} + ${rewarded * REFERRAL_BONUS_DAYS}` })
      .where(eq(billing.userId, referrerUserId));
    await refresh(db, referrerUserId);
  }
  return rewarded;
}

export async function referralStats(db: Db, userId: string) {
  const [r] = (
    await db.execute(sql`select count(*) as total, count(rewarded_at) as rewarded from referrals where referrer_user_id = ${userId}`)
  ).rows;
  return { total: Number(r?.total ?? 0), rewarded: Number(r?.rewarded ?? 0) };
}

export async function setFreeForever(db: Db, userId: string, freeForever: boolean) {
  await ensureBilling(db, userId);
  const r = await db.select().from(billing).where(eq(billing.userId, userId));
  const status = freeForever ? "free" : r[0]?.paidUntil && r[0].paidUntil > new Date() ? "active" : "trial";
  await db.update(billing).set({ freeForever, status, updatedAt: new Date() }).where(eq(billing.userId, userId));
  return refresh(db, userId);
}

export async function startCheckout(db: Db, userId: string, plan: PlanId, checkoutId: string) {
  await db.update(billing).set({ plan, asaasCheckoutId: checkoutId, updatedAt: new Date() }).where(eq(billing.userId, userId));
}

/** Finds the user a webhook is about: our externalReference first, then the Asaas ids we stored. */
export async function findBillingFor(db: Db, ref: { userId?: string | null; subscriptionId?: string | null; checkoutId?: string | null }) {
  if (ref.userId) {
    const [r] = await db.select().from(billing).where(eq(billing.userId, ref.userId));
    if (r) return r;
  }
  if (ref.subscriptionId) {
    const [r] = await db.select().from(billing).where(eq(billing.asaasSubscriptionId, ref.subscriptionId));
    if (r) return r;
  }
  if (ref.checkoutId) {
    const [r] = await db.select().from(billing).where(eq(billing.asaasCheckoutId, ref.checkoutId));
    if (r) return r;
  }
  return null;
}

/** A charge was paid: access runs to the end of that charge's period plus the grace days. */
export async function applyPayment(
  db: Db,
  userId: string,
  p: { dueDate: string; plan: PlanId; subscriptionId?: string | null; customerId?: string | null },
) {
  const due = new Date(`${p.dueDate.slice(0, 10)}T12:00:00Z`);
  const end = new Date(due);
  end.setUTCMonth(end.getUTCMonth() + PLANS[p.plan].months);
  const periodEnd = new Date(end.getTime() + GRACE_DAYS * DAY);
  const [r] = await db.select().from(billing).where(eq(billing.userId, userId));
  const paidUntil = r?.paidUntil && r.paidUntil > periodEnd ? r.paidUntil : periodEnd;
  await db
    .update(billing)
    .set({
      paidUntil,
      plan: p.plan,
      status: r?.freeForever ? "free" : "active",
      ...(p.subscriptionId ? { asaasSubscriptionId: p.subscriptionId } : {}),
      ...(p.customerId ? { asaasCustomerId: p.customerId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(billing.userId, userId));
  return refresh(db, userId);
}

export async function setBillingStatus(db: Db, userId: string, status: "past_due" | "canceled", opts: { clearSubscription?: boolean; revokePaid?: boolean } = {}) {
  const [r] = await db.select().from(billing).where(eq(billing.userId, userId));
  if (!r) return null;
  await db
    .update(billing)
    .set({
      status: r.freeForever ? "free" : status,
      ...(opts.clearSubscription ? { asaasSubscriptionId: null } : {}),
      ...(opts.revokePaid ? { paidUntil: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(eq(billing.userId, userId));
  return refresh(db, userId);
}
