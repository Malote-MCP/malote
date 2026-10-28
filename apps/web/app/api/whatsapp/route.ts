import { enqueueCommand } from "@malote/db";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { currentUser, getOrCreateWaSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Connection status for the dashboard (polled while waiting for the QR scan). */
export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const s = await getOrCreateWaSession(user.id);
  const qr = s.status === "qr" && s.qr ? await QRCode.toDataURL(s.qr, { margin: 1, width: 320 }) : null;
  return Response.json({
    status: s.status,
    enabled: s.enabled,
    phone: s.phone,
    name: s.pushName,
    qr,
    lastSeenAt: s.lastSeenAt,
    error: s.lastError,
  });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action !== "connect" && action !== "logout") {
    return Response.json({ error: "action deve ser connect ou logout" }, { status: 400 });
  }
  const s = await getOrCreateWaSession(user.id);
  await enqueueCommand(db, { sessionId: s.id, type: action, source: "web" });
  return Response.json({ ok: true });
}
