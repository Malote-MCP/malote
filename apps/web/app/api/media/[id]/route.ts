import { getSessionByUserId, loadOpener, mediaFiles } from "@malote/db";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { movedToEnclave } from "@/lib/enclave";
import { verifyToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Serves a downloaded media file to its owner. Needs the MCP token: it is what decrypts the file. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const moved = movedToEnclave();
  if (moved) return moved;
  const { id } = await params;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const auth = bearer ? await verifyToken(bearer) : null;
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const session = await getSessionByUserId(db, auth.userId);
  if (!session || !/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const [file] = await db
    .select()
    .from(mediaFiles)
    .where(and(eq(mediaFiles.id, id), eq(mediaFiles.sessionId, session.id)))
    .limit(1);
  if (!file) return Response.json({ error: "Not found" }, { status: 404 });
  const opener = await loadOpener(db, session, auth.privateKey);
  const data = opener.openBytes(file.data, file.epochId);
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": file.mimetype,
      "content-length": String(data.length),
      "content-disposition": `inline; filename="malote-${file.id}"`,
      "cache-control": "private, no-store",
    },
  });
}
