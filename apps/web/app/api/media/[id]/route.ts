import { getSessionByUserId, mediaFiles } from "@malote/db";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Serves a downloaded media file to its owner (browser session or MCP bearer token). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const userId = bearer ? (await verifyToken(bearer))?.userId : (await currentUser())?.id;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getSessionByUserId(db, userId);
  if (!session || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const [file] = await db
    .select()
    .from(mediaFiles)
    .where(and(eq(mediaFiles.id, id), eq(mediaFiles.sessionId, session.id)))
    .limit(1);
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  const name = encodeURIComponent(file.fileName ?? `malote-${file.id}`);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.mimetype,
      "content-length": String(file.size),
      "content-disposition": `inline; filename*=UTF-8''${name}`,
      "cache-control": "private, max-age=3600",
    },
  });
}
