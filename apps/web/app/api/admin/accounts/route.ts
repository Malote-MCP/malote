import { sql } from "drizzle-orm";
import { deleteAccount } from "@malote/db";
import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return Response.json({ error: "Not found" }, { status: 404 });
  if (req.headers.get("origin") !== new URL(req.url).origin)
    return Response.json({ error: "Origem inválida." }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.userId !== "string" ||
    typeof body.confirmation !== "string"
  )
    return Response.json({ error: "Confirmação inválida." }, { status: 400 });
  if (body.userId === admin.id)
    return Response.json(
      {
        error:
          "Use as configurações da sua conta para excluir a própria conta.",
      },
      { status: 400 },
    );
  const [user] = (
    await db.execute(
      sql`select email from neon_auth."user" where id = ${body.userId}`,
    )
  ).rows;
  if (!user)
    return Response.json({ error: "Conta não encontrada." }, { status: 404 });
  if (body.confirmation !== user.email)
    return Response.json(
      { error: "Digite o e-mail da conta para confirmar." },
      { status: 400 },
    );
  await deleteAccount(db, body.userId);
  return Response.json({ ok: true });
}
