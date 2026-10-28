import {
  enqueueCommand,
  getMessages,
  getSessionByUserId,
  listChats,
  mediaFiles,
  searchContacts,
  searchMessages,
  waitForCommand,
  type CommandType,
} from "@malote/db";
import { eq } from "drizzle-orm";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { http?: { authInfo?: { extra?: Record<string, unknown> } } };

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

/** Loads the caller's WhatsApp session from the verified token. */
async function sessionFor(ctx: Ctx) {
  const userId = ctx.http?.authInfo?.extra?.userId as string | undefined;
  if (!userId) throw new Error("Não autenticado.");
  const session = await getSessionByUserId(db, userId);
  if (!session) throw new Error("Nenhum WhatsApp conectado. Conecte em https://malote.fly.dev/app.");
  return session;
}

function resolveJid(jid: string, selfJid: string | null) {
  if (jid === "me" || jid === "self") {
    if (!selfJid) throw new Error("WhatsApp não está conectado.");
    return selfJid;
  }
  return jid.includes("@") ? jid : `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
}

/** Sends a command to the worker and waits for its result. */
async function runCommand(sessionId: string, type: CommandType, payload: unknown, timeoutMs = 45_000) {
  const id = await enqueueCommand(db, { sessionId, type, payload, source: "mcp" });
  const done = await waitForCommand(db, id, timeoutMs);
  if (!done) throw new Error("O WhatsApp demorou para responder. Tente de novo.");
  if (done.status === "error") throw new Error(done.error ?? "Falhou.");
  return done.result as Record<string, unknown>;
}

function wrap<A>(fn: (args: A, ctx: Ctx) => Promise<ReturnType<typeof text> | Awaited<ReturnType<typeof downloadResult>>>) {
  return async (args: A, ctx: Ctx) => {
    try {
      return await fn(args, ctx);
    } catch (e) {
      return fail((e as Error).message);
    }
  };
}

async function downloadResult(result: Record<string, unknown>, origin: string) {
  const mediaId = result.mediaId as string;
  const mimetype = result.mimetype as string;
  const size = result.size as number;
  const content: ({ type: "text"; text: string } | { type: "image"; data: string; mimeType: string })[] = [
    {
      type: "text",
      text: JSON.stringify(
        { media_id: mediaId, mimetype, file_name: result.fileName ?? null, size, url: `${origin}/api/media/${mediaId}` },
        null,
        2,
      ),
    },
  ];
  // Small images are returned inline so the model can see them.
  if (/^image\/(jpeg|png|gif|webp)$/.test(mimetype) && size < 3_000_000) {
    const [file] = await db.select({ data: mediaFiles.data }).from(mediaFiles).where(eq(mediaFiles.id, mediaId));
    if (file) content.push({ type: "image", data: file.data.toString("base64"), mimeType: mimetype });
  }
  return { content };
}

const origin = () => process.env.PUBLIC_URL ?? "https://malote.fly.dev";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "whatsapp_status",
      {
        title: "Status do WhatsApp",
        description: "Mostra se o WhatsApp do usuário está conectado ao Malote e qual número está em uso.",
        inputSchema: z.object({}),
      },
      wrap(async (_args, ctx) => {
        const s = await sessionFor(ctx);
        return text({ status: s.status, phone: s.phone, name: s.pushName, last_seen: s.lastSeenAt, error: s.lastError });
      }),
    );

    server.registerTool(
      "list_chats",
      {
        title: "Listar conversas",
        description: "Lista as conversas (pessoas e grupos), mais recentes primeiro. Use query para filtrar pelo nome.",
        inputSchema: z.object({
          query: z.string().optional(),
          limit: z.number().int().min(1).max(200).optional(),
        }),
      },
      wrap(async ({ query, limit }: { query?: string; limit?: number }, ctx) => {
        const s = await sessionFor(ctx);
        return text(await listChats(db, s.id, { query, limit }));
      }),
    );

    server.registerTool(
      "get_messages",
      {
        title: "Ler mensagens",
        description:
          'Lê as mensagens de uma conversa em ordem cronológica. chat_jid vem de list_chats; use "me" para o chat consigo mesmo. Para paginar para trás, passe before com o time da mensagem mais antiga.',
        inputSchema: z.object({
          chat_jid: z.string(),
          limit: z.number().int().min(1).max(200).optional(),
          before: z.string().optional().describe("Timestamp ISO 8601"),
        }),
      },
      wrap(async ({ chat_jid, limit, before }: { chat_jid: string; limit?: number; before?: string }, ctx) => {
        const s = await sessionFor(ctx);
        return text(await getMessages(db, s.id, { chatJid: resolveJid(chat_jid, s.waJid), limit, before }));
      }),
    );

    server.registerTool(
      "search_messages",
      {
        title: "Buscar mensagens",
        description: "Busca mensagens por texto (em português, ignora acentos/flexões) em todas as conversas ou em uma.",
        inputSchema: z.object({
          query: z.string(),
          chat_jid: z.string().optional(),
          from_me: z.boolean().optional(),
          since: z.string().optional().describe("ISO 8601"),
          until: z.string().optional().describe("ISO 8601"),
          limit: z.number().int().min(1).max(200).optional(),
        }),
      },
      wrap(
        async (
          a: { query: string; chat_jid?: string; from_me?: boolean; since?: string; until?: string; limit?: number },
          ctx,
        ) => {
          const s = await sessionFor(ctx);
          return text(
            await searchMessages(db, s.id, {
              query: a.query,
              chatJid: a.chat_jid ? resolveJid(a.chat_jid, s.waJid) : undefined,
              fromMe: a.from_me,
              since: a.since,
              until: a.until,
              limit: a.limit,
            }),
          );
        },
      ),
    );

    server.registerTool(
      "search_contacts",
      {
        title: "Buscar contatos",
        description: "Procura contatos e grupos pelo nome ou número e devolve o jid para usar nas outras ferramentas.",
        inputSchema: z.object({ query: z.string() }),
      },
      wrap(async ({ query }: { query: string }, ctx) => {
        const s = await sessionFor(ctx);
        return text(await searchContacts(db, s.id, { query }));
      }),
    );

    server.registerTool(
      "send_message",
      {
        title: "Enviar mensagem",
        description:
          'Envia uma mensagem de texto pelo WhatsApp do usuário. Só envia para conversas que já existem (ou "me"). Confirme com o usuário antes de enviar para outras pessoas.',
        inputSchema: z.object({
          chat_jid: z.string(),
          text: z.string().min(1).max(4000),
          reply_to_message_id: z.string().optional(),
        }),
      },
      wrap(async (a: { chat_jid: string; text: string; reply_to_message_id?: string }, ctx) => {
        const s = await sessionFor(ctx);
        const result = await runCommand(s.id, "send_text", {
          chatJid: resolveJid(a.chat_jid, s.waJid),
          text: a.text,
          replyToId: a.reply_to_message_id,
        });
        return text({ sent: true, ...result });
      }),
    );

    server.registerTool(
      "send_file",
      {
        title: "Enviar arquivo",
        description:
          "Envia foto, vídeo, áudio ou documento. Use media_id (de download_media) para reenviar uma mídia, ou base64 + mimetype + file_name para um arquivo novo (até 25 MB).",
        inputSchema: z.object({
          chat_jid: z.string(),
          media_id: z.string().optional(),
          base64: z.string().optional(),
          mimetype: z.string().optional(),
          file_name: z.string().optional(),
          caption: z.string().optional(),
        }),
      },
      wrap(
        async (
          a: { chat_jid: string; media_id?: string; base64?: string; mimetype?: string; file_name?: string; caption?: string },
          ctx,
        ) => {
          if (!a.media_id && !a.base64) throw new Error("Informe media_id ou base64.");
          const s = await sessionFor(ctx);
          const result = await runCommand(s.id, "send_file", {
            chatJid: resolveJid(a.chat_jid, s.waJid),
            mediaId: a.media_id,
            base64: a.base64,
            mimetype: a.mimetype,
            fileName: a.file_name,
            caption: a.caption,
          });
          return text({ sent: true, ...result });
        },
      ),
    );

    server.registerTool(
      "download_media",
      {
        title: "Baixar mídia",
        description:
          "Baixa a mídia de uma mensagem (foto, vídeo, áudio, documento). Devolve media_id (para send_file) e uma URL autenticada; imagens pequenas vêm inline.",
        inputSchema: z.object({ chat_jid: z.string(), message_id: z.string() }),
      },
      wrap(async ({ chat_jid, message_id }: { chat_jid: string; message_id: string }, ctx) => {
        const s = await sessionFor(ctx);
        const result = await runCommand(s.id, "download_media", {
          chatJid: resolveJid(chat_jid, s.waJid),
          messageId: message_id,
        });
        return downloadResult(result, origin());
      }),
    );
  },
  { serverInfo: { name: "malote", version: "0.1.0" } },
);

const authed = withMcpAuth(
  handler,
  async (_req, bearer) => {
    if (!bearer) return undefined;
    const row = await verifyToken(bearer);
    if (!row) return undefined;
    return { token: bearer, clientId: `token:${row.id}`, scopes: ["whatsapp"], extra: { userId: row.userId } };
  },
  { required: true },
);

export { authed as GET, authed as POST, authed as DELETE };
