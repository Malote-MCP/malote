import { setFreeForever } from "@malote/db";
import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Marks a user as free forever ({ userId, freeForever: true }) or back to the normal plan rules. */
export async function POST(req: Request) {
  if (!(await currentAdmin())) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { userId?: string; freeForever?: unknown } | null;
  if (!body?.userId || !/^[0-9a-f-]{36}$/i.test(body.userId) || typeof body.freeForever !== "boolean") {
    return Response.json({ error: "Pedido inválido." }, { status: 400 });
  }
  await setFreeForever(db, body.userId, body.freeForever);
  return Response.json({ ok: true });
}
