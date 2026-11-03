import { timingSafeEqual } from "node:crypto";
import { applyPayment, billingEvents, findBillingFor, setBillingStatus, type Db } from "@malote/db";
import { getSubscription, planOfCycle } from "@/lib/asaas";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type Payment = {
  id: string;
  customer?: string;
  subscription?: string | null;
  checkoutSession?: string | null;
  externalReference?: string | null;
  dueDate?: string;
  status?: string;
};
type Event = {
  id?: string;
  event?: string;
  payment?: Payment;
  subscription?: { id: string; externalReference?: string | null; checkoutSession?: string | null; cycle?: string };
  checkout?: { id: string };
};

function authorized(req: Request) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  const got = req.headers.get("asaas-access-token");
  if (!expected || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(tx: Db, e: Event) {
  const p = e.payment;
  switch (e.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED": {
      if (!p?.subscription || !p.dueDate) return;
      const sub = await getSubscription(p.subscription);
      const row = await findBillingFor(tx, {
        userId: p.externalReference ?? sub.externalReference,
        subscriptionId: p.subscription,
        checkoutId: p.checkoutSession,
      });
      if (!row) throw new Error(`no user for subscription ${p.subscription}`);
      await applyPayment(tx, row.userId, {
        dueDate: p.dueDate,
        plan: planOfCycle(sub.cycle),
        subscriptionId: p.subscription,
        customerId: p.customer ?? sub.customer,
      });
      return;
    }
    case "PAYMENT_OVERDUE": {
      const row = p && (await findBillingFor(tx, { userId: p.externalReference, subscriptionId: p.subscription, checkoutId: p.checkoutSession }));
      if (row) await setBillingStatus(tx, row.userId, "past_due");
      return;
    }
    case "PAYMENT_REFUNDED":
    case "PAYMENT_CHARGEBACK_REQUESTED": {
      const row = p && (await findBillingFor(tx, { userId: p.externalReference, subscriptionId: p.subscription, checkoutId: p.checkoutSession }));
      if (row) await setBillingStatus(tx, row.userId, "canceled", { revokePaid: true });
      return;
    }
    case "SUBSCRIPTION_DELETED":
    case "SUBSCRIPTION_INACTIVATED": {
      const s = e.subscription;
      const row = s && (await findBillingFor(tx, { userId: s.externalReference, subscriptionId: s.id, checkoutId: s.checkoutSession }));
      // Access already paid for runs to its end; only renewals stop.
      if (row && row.asaasSubscriptionId === s!.id) await setBillingStatus(tx, row.userId, "canceled", { clearSubscription: true });
      return;
    }
    default:
      return; // other events are not needed; acknowledging them keeps the queue moving
  }
}

/** Asaas webhook. Each event is processed once (event id) inside one transaction with its effects. */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const e = (await req.json().catch(() => null)) as Event | null;
  if (!e?.id || !e.event) return Response.json({ ok: true });
  try {
    await db.transaction(async (tx) => {
      const fresh = await tx.insert(billingEvents).values({ id: e.id!, event: e.event! }).onConflictDoNothing().returning();
      if (!fresh.length) return;
      await handle(tx as unknown as Db, e);
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("asaas webhook", e.event, e.id, (err as Error).message);
    return Response.json({ error: "retry" }, { status: 500 });
  }
}
