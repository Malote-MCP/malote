import { adminAnalytics, adminUserDaily, parseAdminFilters } from "@malote/db";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyAdminMcpToken } from "@/lib/admin-mcp-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  from: z
    .string()
    .optional()
    .describe("Data inicial inclusiva AAAA-MM-DD, UTC; padrão: 29 dias atrás."),
  to: z
    .string()
    .optional()
    .describe(
      "Data final inclusiva AAAA-MM-DD, UTC; padrão: hoje. Máximo: 366 dias.",
    ),
  query: z
    .string()
    .max(200)
    .optional()
    .describe("Trecho literal do e-mail ou ID exato da conta."),
  status: z
    .enum(["", "connected", "logged_out", "pending", "qr", "error", "none"])
    .optional(),
  activity: z
    .enum(["", "active", "inactive"])
    .optional()
    .describe("Com ou sem envios no período."),
});
const handler = createMcpHandler(
  (server) => {
    const register = (
      name: string,
      description: string,
      run: typeof adminAnalytics | typeof adminUserDaily,
    ) => {
      server.registerTool(
        name,
        {
          description,
          inputSchema,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            openWorldHint: false,
          },
        },
        async (args) => {
          try {
            const data = await run(db, parseAdminFilters(args));
            return {
              content: [{ type: "text" as const, text: JSON.stringify(data) }],
            };
          } catch (e) {
            return {
              isError: true,
              content: [{ type: "text" as const, text: (e as Error).message }],
            };
          }
        },
      );
    };
    register(
      "admin_analytics",
      "Métricas administrativas e contas filtradas, envios e DAU por dia UTC. Ativo = ao menos um envio bem-sucedido pelo Malote. Contadores desde sua implantação; excluir contas remove suas contagens. Não inclui leituras nem envios diretos pelo WhatsApp.",
      adminAnalytics,
    );
    register(
      "admin_user_daily",
      "Envios bem-sucedidos pelo Malote por usuário e dia UTC no período filtrado. Inclui e-mail e ID, só dias com envios. Exclusões de contas removem suas contagens.",
      adminUserDaily,
    );
  },
  { serverInfo: { name: "malote-admin", version: "1.0.0" } },
);

const authed = withMcpAuth(
  handler,
  async (_req, bearer) => {
    if (!verifyAdminMcpToken(bearer)) return undefined;
    return {
      token: bearer!,
      clientId: "malote-admin-reporting",
      scopes: ["admin:read"],
    };
  },
  { required: true },
);

const route = async (req: Request) => {
  const response = await authed(req);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
};

export { route as GET, route as POST, route as DELETE };
