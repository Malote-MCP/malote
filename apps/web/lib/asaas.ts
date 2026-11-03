/**
 * Asaas API (https://docs.asaas.com). The key decides the environment: sandbox keys start with
 * `$aact_hmlg_`, production keys with `$aact_prod_`. Card and Pix data are typed on Asaas' own
 * checkout page; this server never sees them.
 */
import { billing, PLANS, type Db, type PlanId } from "@malote/db";
import { eq } from "drizzle-orm";

const key = () => {
  const k = process.env.ASAAS_API_KEY;
  if (!k) throw new Error("Pagamentos ainda não configurados.");
  return k;
};
const baseUrl = () => (key().startsWith("$aact_prod_") ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3");
const checkoutHost = () => (key().startsWith("$aact_prod_") ? "https://asaas.com" : "https://sandbox.asaas.com");

export const asaasConfigured = () => Boolean(process.env.ASAAS_API_KEY);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { access_token: key(), "content-type": "application/json", "user-agent": "Malote/1.0" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as (T & { errors?: { description?: string }[] }) | null;
  if (!res.ok) {
    const detail = data?.errors?.map((e) => e.description).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Asaas: ${detail}`);
  }
  return data as T;
}

/** "YYYY-MM-DD HH:mm:ss" in Brazil time, the format the checkout's subscription block uses. */
function asaasDateTime(d: Date) {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
  return s.replace("T", " ");
}

/**
 * Hosted checkout. Card: a recurring plan whose first charge is due when the trial (or the current
 * paid period) ends, so nobody pays for days they already have. Pix: one payment for one period,
 * added after the access the user already has.
 */
export async function createCheckout(opts: {
  userId: string;
  email: string;
  name: string;
  plan: PlanId;
  method: "card" | "pix";
  firstDueAt: Date;
  publicUrl: string;
}) {
  const plan = PLANS[opts.plan];
  // Asaas only renews on card; Pix is a one-off payment for one period.
  const card = opts.method === "card";
  const created = await call<{ id: string; link?: string }>("POST", "/checkouts", {
    billingTypes: [card ? "CREDIT_CARD" : "PIX"],
    chargeTypes: [card ? "RECURRENT" : "DETACHED"],
    minutesToExpire: 120,
    externalReference: opts.userId,
    callback: {
      successUrl: `${opts.publicUrl}/app?pagamento=ok`,
      cancelUrl: `${opts.publicUrl}/app?pagamento=cancelado`,
      expiredUrl: `${opts.publicUrl}/app?pagamento=expirado`,
    },
    items: [
      {
        name: `Malote ${plan.label}`,
        description: "WhatsApp conectado ao seu assistente via MCP",
        quantity: 1,
        value: plan.value,
        externalReference: opts.plan,
      },
    ],
    ...(card ? { subscription: { cycle: plan.cycle, nextDueDate: asaasDateTime(opts.firstDueAt) } } : {}),
    customerData: { name: opts.name, email: opts.email },
  });
  return { id: created.id, url: created.link ?? `${checkoutHost()}/checkoutSession/show?id=${created.id}` };
}

export async function getSubscription(id: string) {
  return call<{ id: string; cycle: string; value: number; status: string; externalReference?: string | null; customer: string }>(
    "GET",
    `/subscriptions/${id}`,
  );
}

export async function cancelSubscription(id: string) {
  return call<{ deleted: boolean }>("DELETE", `/subscriptions/${id}`);
}

export const planOfCycle = (cycle: string | undefined): PlanId => (cycle === "YEARLY" ? "yearly" : "monthly");

/**
 * Cancels the user's Asaas renewal before the account is deleted, so a deleted account is never
 * charged again. Returns false when Asaas could not be reached; the caller must not delete then.
 */
export async function cancelRenewalBeforeDelete(db: Db, userId: string) {
  const [b] = await db.select({ sub: billing.asaasSubscriptionId }).from(billing).where(eq(billing.userId, userId));
  if (!b?.sub || !asaasConfigured()) return true;
  try {
    await cancelSubscription(b.sub);
    return true;
  } catch (err) {
    console.error("cancel subscription on account delete", (err as Error).message);
    return false;
  }
}
