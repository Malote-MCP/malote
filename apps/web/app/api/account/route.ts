import { deleteAccount } from "@malote/db";
import { cancelRenewalBeforeDelete } from "@/lib/asaas";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Deletes the signed-in user's account and everything stored for it (Política 12.3). */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "EXCLUIR") return Response.json({ error: 'Digite EXCLUIR para confirmar.' }, { status: 400 });
  if (!(await cancelRenewalBeforeDelete(db, user.id)))
    return Response.json({ error: "Não foi possível cancelar sua assinatura agora. Tente de novo em instantes." }, { status: 502 });
  await deleteAccount(db, user.id);
  return Response.json({ ok: true });
}
