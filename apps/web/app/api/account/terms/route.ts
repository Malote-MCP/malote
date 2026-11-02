import { acceptCurrentTerms } from "@malote/db";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Records that the signed-in user accepted the current Terms of Use and Privacy Policy (Termos 2.1). */
export async function POST() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await acceptCurrentTerms(db, user.id);
  return Response.json({ ok: true });
}
