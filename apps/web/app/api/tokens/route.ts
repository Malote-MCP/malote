import { listTokens, revokeToken } from "@malote/db";
import { db } from "@/lib/db";
import { movedToEnclave } from "@/lib/enclave";
import { currentUser } from "@/lib/session";
import { createToken, NeedsAuthorization } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  const moved = movedToEnclave();
  if (moved) return moved;
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listTokens(db, user.id));
}

export async function POST(req: Request) {
  const moved = movedToEnclave();
  if (moved) return moved;
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { name, authorizeWith, reset } = (await req.json().catch(() => ({}))) as {
    name?: string;
    authorizeWith?: string;
    reset?: boolean;
  };
  try {
    const created = await createToken(user.id, (name ?? "").trim().slice(0, 60) || "Claude", { authorizeWith, reset: reset === true });
    return Response.json(created);
  } catch (e) {
    if (e instanceof NeedsAuthorization) {
      return Response.json({ error: "Informe um token válido desta conta para destravar sua chave." }, { status: 409 });
    }
    throw e;
  }
}

export async function DELETE(req: Request) {
  const moved = movedToEnclave();
  if (moved) return moved;
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });
  await revokeToken(db, user.id, id);
  return Response.json({ ok: true });
}
