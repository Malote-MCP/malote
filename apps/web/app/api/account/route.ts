import { deleteAccount } from "@malote/db";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Deletes the signed-in user's account and everything stored for it (Política 12.3). */
export async function DELETE(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "EXCLUIR") return Response.json({ error: 'Digite EXCLUIR para confirmar.' }, { status: 400 });
  await deleteAccount(db, user.id);
  return Response.json({ ok: true });
}
