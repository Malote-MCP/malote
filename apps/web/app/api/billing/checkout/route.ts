import { billing, ensureBilling, isPlan, setBillingStatus, startCheckout } from "@malote/db";
import { eq } from "drizzle-orm";
import { asaasConfigured, cancelSubscription, createCheckout } from "@/lib/asaas";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const publicUrl = () => process.env.PUBLIC_URL ?? "https://malote.io";

/** Starts an Asaas checkout for { plan: "monthly" | "yearly" } and returns its URL. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!asaasConfigured()) return Response.json({ error: "Pagamentos ainda não estão disponíveis." }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { plan?: unknown } | null;
  if (!isPlan(body?.plan)) return Response.json({ error: "Plano inválido." }, { status: 400 });
  const row = await ensureBilling(db, user.id);
  if (row.freeForever) return Response.json({ error: "Sua conta já é gratuita." }, { status: 400 });
  if (row.asaasSubscriptionId && row.status === "active") {
    return Response.json({ error: "Você já tem uma assinatura ativa. Cancele antes de trocar de plano." }, { status: 409 });
  }
  // First charge when the access already granted (trial, bonus or paid period) runs out.
  const firstDueAt = new Date(Math.max(Date.now() + 60_000, row.accessUntil?.getTime() ?? 0));
  try {
    const checkout = await createCheckout({
      userId: user.id,
      email: user.email,
      name: user.name || user.email.split("@")[0],
      plan: body.plan,
      firstDueAt,
      publicUrl: publicUrl(),
    });
    await startCheckout(db, user.id, body.plan, checkout.id);
    return Response.json({ url: checkout.url });
  } catch (e) {
    console.error("checkout", (e as Error).message);
    return Response.json({ error: "Não foi possível abrir o pagamento. Tente de novo." }, { status: 502 });
  }
}

/** Cancels renewals. Access already paid for runs to its end. */
export async function DELETE() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const [row] = await db.select().from(billing).where(eq(billing.userId, user.id));
  if (!row?.asaasSubscriptionId) return Response.json({ error: "Nenhuma assinatura ativa." }, { status: 404 });
  try {
    await cancelSubscription(row.asaasSubscriptionId);
  } catch (e) {
    console.error("cancel", (e as Error).message);
    return Response.json({ error: "Não foi possível cancelar agora. Tente de novo." }, { status: 502 });
  }
  await setBillingStatus(db, user.id, "canceled", { clearSubscription: true });
  return Response.json({ ok: true });
}
