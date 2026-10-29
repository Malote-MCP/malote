import { queueOps, registerTools, type Caller } from "@malote/mcp";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { db } from "@/lib/db";
import { movedToEnclave } from "@/lib/enclave";
import { verifyToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const origin = process.env.PUBLIC_URL ?? "https://malote.io";

const handler = createMcpHandler(
  (server) =>
    registerTools(
      server,
      { db, ops: queueOps(db), mediaUrl: (id) => `${origin}/api/media/${id}`, panelUrl: `${origin}/app` },
      (ctx) => ((ctx as { http?: { authInfo?: { extra?: Caller } } }).http?.authInfo?.extra as Caller | undefined) ?? null,
    ),
  { serverInfo: { name: "malote", version: "0.1.0" } },
);

const authed = withMcpAuth(
  handler,
  async (_req, bearer) => {
    if (!bearer) return undefined;
    const row = await verifyToken(bearer);
    if (!row) return undefined;
    const caller: Caller = { userId: row.userId, privateKey: row.privateKey };
    return { token: bearer, clientId: `token:${row.id}`, scopes: ["whatsapp"], extra: caller };
  },
  { required: true },
);

const route = (req: Request) => movedToEnclave() ?? authed(req);

export { route as GET, route as POST, route as DELETE };
