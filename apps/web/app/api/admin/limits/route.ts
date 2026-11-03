import { GLOBAL_LIMITS, SEND_LIMIT_CAPS, setSendLimits } from "@malote/db";
import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

const parse = (v: unknown, cap: number) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > cap) throw new Error(`Use um número inteiro entre 1 e ${cap}.`);
  return n;
};

/** Sets the default send limits ({ userId: "*" }) or one user's override (both empty clears it). */
export async function POST(req: Request) {
  if (!(await currentAdmin())) return Response.json({ error: "Not found" }, { status: 404 });
  const body = (await req.json().catch(() => null)) as { userId?: string; perMinute?: unknown; perDay?: unknown } | null;
  const userId = body?.userId;
  if (!userId || (userId !== GLOBAL_LIMITS && !/^[0-9a-f-]{36}$/i.test(userId))) {
    return Response.json({ error: "Usuário inválido." }, { status: 400 });
  }
  try {
    const limits = { perMinute: parse(body.perMinute, SEND_LIMIT_CAPS.perMinute), perDay: parse(body.perDay, SEND_LIMIT_CAPS.perDay) };
    await setSendLimits(db, userId, limits);
    return Response.json({ ok: true, ...limits });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
