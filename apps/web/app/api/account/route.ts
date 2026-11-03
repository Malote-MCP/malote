import { billing, deleteAccount } from "@malote/db";
import { eq } from "drizzle-orm";
import { asaasConfigured, cancelSubscription } from "@/lib/asaas";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Deletes the signed-in user's account and everything stored for it (Política 12.3). */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "EXCLUIR") return Response.json({ error: 'Digite EXCLUIR para confirmar.' }, { status: 400 });
  // Stop renewals first: a deleted account must not keep being charged.
  const [b] = await db.select({ sub: billing.asaasSubscriptionId }).from(billing).where(eq(billing.userId, user.id));
  if (b?.sub && asaasConfigured()) {
    try {
      await cancelSubscription(b.sub);
    } catch (err) {
      console.error("cancel subscription on account delete", (err as Error).message);
      return Response.json({ error: "Não foi possível cancelar sua assinatura agora. Tente de novo em instantes." }, { status: 502 });
    }
  }
  await deleteAccount(db, user.id);
  return Response.json({ ok: true });
}
