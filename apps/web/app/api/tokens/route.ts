import { apiTokens, getSessionByUserId } from "@malote/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { createToken, NeedsAuthorization } from "@/lib/tokens";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await db
    .select({ id: apiTokens.id, name: apiTokens.name, prefix: apiTokens.prefix, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
    .from(apiTokens)
    .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))
    .orderBy(desc(apiTokens.createdAt));
  const session = await getSessionByUserId(db, user.id);
  return Response.json({ tokens: rows, hasKey: !!session?.publicKey });
}

export async function POST(req: Request) {
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
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });
  await db
    .update(apiTokens)
    // Dropping the wrapped key makes the revoked token useless even if it leaks later.
    .set({ revokedAt: new Date(), wrappedKey: null })
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, user.id)));
  return Response.json({ ok: true });
}
