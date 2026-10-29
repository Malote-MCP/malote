/**
 * The Malote MCP tools, shared by the hosted web app (which reaches WhatsApp through the command
 * queue) and the enclave (which talks to its in-process WhatsApp sessions directly).
 */
import {
  deleteCommand,
  enqueueCommand,
  getMessage,
  getMessages,
  getSessionByUserId,
  listChats,
  loadOpener,
  mediaFiles,
  searchContacts,
  searchMessages,
  waitForCommand,
  type CommandType,
  type Db,
  type DownloadMediaPayload,
  type Opener,
  type SendFilePayload,
  type SendTextPayload,
} from "@malote/db";
import type { McpServer } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/** The WhatsApp actions a tool can ask for; each runs against the caller's own session. */
export type WhatsAppOps = {
  sendText(sessionId: string, p: SendTextPayload): Promise<Record<string, unknown>>;
  sendFile(sessionId: string, p: SendFilePayload): Promise<Record<string, unknown>>;
  downloadMedia(sessionId: string, p: DownloadMediaPayload): Promise<{ mediaId: string; size: number }>;
};

/** Who is calling: the token's owner and the private key that token unlocked (in memory only). */
export type Caller = { userId: string; privateKey: string | null };

export type ToolEnv = {
  db: Db;
  ops: WhatsAppOps;
  /** Authenticated URL where a downloaded media file can be fetched. */
  mediaUrl: (mediaId: string) => string;
  /** Where the user manages their connection, shown in error messages. */
  panelUrl: string;
};

/** Ops for a process without WhatsApp sessions: hand the work to the worker through the command queue. */
export function queueOps(db: Db, timeoutMs = 45_000): WhatsAppOps {
  async function run(sessionId: string, type: CommandType, payload: unknown) {
    const id = await enqueueCommand(db, { sessionId, type, payload, source: "mcp" });
    const done = await waitForCommand(db, id, timeoutMs);
    if (!done) throw new Error("O WhatsApp demorou para responder. Se era um envio, confira a conversa antes de tentar de novo.");
    await deleteCommand(db, id);
    if (done.status === "error") throw new Error(done.error ?? "Falhou.");
    return done.result as Record<string, unknown>;
  }
  return {
    sendText: (s, p) => run(s, "send_text", p),
    sendFile: (s, p) => run(s, "send_file", p),
    downloadMedia: async (s, p) => (await run(s, "download_media", p)) as { mediaId: string; size: number },
  };
}

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

function resolveJid(jid: string, selfJid: string | null) {
  if (jid === "me" || jid === "self") {
    if (!selfJid) throw new Error("WhatsApp não está conectado.");
    return selfJid;
  }
  return jid.includes("@") ? jid : `${jid.replace(/\D/g, "")}@s.whatsapp.net`;
}

/**
 * Registers the tools. `caller` extracts the authenticated caller from a tool call's context; it
 * returns null when the request is not authenticated.
 */
export function registerTools(server: McpServer, env: ToolEnv, caller: (ctx: unknown) => Caller | null) {
  const { db, ops } = env;

  /** The caller's WhatsApp session plus a decryptor built from the key their token unlocked. */
  async function sessionFor(ctx: unknown) {
    const c = caller(ctx);
    if (!c) throw new Error("Não autenticado.");
    const session = await getSessionByUserId(db, c.userId);
    if (!session) throw new Error(`Nenhum WhatsApp conectado. Conecte em ${env.panelUrl}.`);
    const opener = await loadOpener(db, session, c.privateKey);
    return Object.assign(session, { opener });
  }

  function wrap<A>(fn: (args: A, ctx: unknown) => Promise<{ content: Content[] }>) {
    return async (args: A, ctx: unknown) => {
      try {
        return await fn(args, ctx);
      } catch (e) {
        return fail((e as Error).message);
      }
    };
  }

  async function downloadResult(opener: Opener, file: { mediaId: string; mimetype: string; fileName: string | null; size: number }) {
    const { mediaId, mimetype, size } = file;
    const content: Content[] = [
      {
        type: "text",
        text: JSON.stringify({ media_id: mediaId, mimetype, file_name: file.fileName, size, url: env.mediaUrl(mediaId) }, null, 2),
      },
    ];
    // Small images are returned inline so the model can see them.
    if (/^image\/(jpeg|png|gif|webp)$/.test(mimetype) && size < 3_000_000) {
      const [row] = await db
        .select({ data: mediaFiles.data, epochId: mediaFiles.epochId })
        .from(mediaFiles)
        .where(eq(mediaFiles.id, mediaId));
      if (row) content.push({ type: "image", data: opener.openBytes(row.data, row.epochId).toString("base64"), mimeType: mimetype });
    }
    return { content };
  }

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
      return text(await listChats(db, s.opener, s.id, { query, limit }));
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
      return text(await getMessages(db, s.opener, s.id, { chatJid: resolveJid(chat_jid, s.waJid), limit, before }));
    }),
  );

  server.registerTool(
    "search_messages",
    {
      title: "Buscar mensagens",
      description:
        'Busca mensagens por texto (ignora maiúsculas e acentos; todas as palavras precisam aparecer; use aspas para frase exata), das mais recentes para as mais antigas. O histórico é cifrado e a busca decifra mensagem a mensagem: se complete=false, repita com until=scanned_until para continuar mais para trás. Filtrar por chat_jid ou since deixa a busca bem mais rápida.',
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
        const r = await searchMessages(db, s.opener, s.id, {
          query: a.query,
          chatJid: a.chat_jid ? resolveJid(a.chat_jid, s.waJid) : undefined,
          fromMe: a.from_me,
          since: a.since,
          until: a.until,
          limit: a.limit,
        });
        return text({ messages: r.messages, complete: r.complete, scanned_until: r.scannedUntil });
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
      return text(await searchContacts(db, s.opener, s.id, { query }));
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
      const chatJid = resolveJid(a.chat_jid, s.waJid);
      const q = a.reply_to_message_id ? await getMessage(db, s.opener, s.id, chatJid, a.reply_to_message_id) : null;
      const result = await ops.sendText(s.id, {
        chatJid,
        text: a.text,
        quoted: q ? { id: q.id, fromMe: q.fromMe, senderJid: q.senderJid, text: q.text, raw: q.raw } : undefined,
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
        let file = { base64: a.base64 ?? "", mimetype: a.mimetype ?? "application/octet-stream", fileName: a.file_name };
        if (a.media_id) {
          // Stored media is encrypted; decrypt it here so the sender gets the plain file.
          const [row] = await db
            .select()
            .from(mediaFiles)
            .where(and(eq(mediaFiles.id, a.media_id), eq(mediaFiles.sessionId, s.id)))
            .limit(1);
          if (!row) throw new Error("media_id não encontrado.");
          const msg = row.chatJid && row.messageId ? await getMessage(db, s.opener, s.id, row.chatJid, row.messageId) : null;
          file = {
            base64: s.opener.openBytes(row.data, row.epochId).toString("base64"),
            mimetype: row.mimetype,
            fileName: a.file_name ?? msg?.media?.fileName,
          };
        }
        const result = await ops.sendFile(s.id, { chatJid: resolveJid(a.chat_jid, s.waJid), ...file, caption: a.caption });
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
      const chatJid = resolveJid(chat_jid, s.waJid);
      const msg = await getMessage(db, s.opener, s.id, chatJid, message_id);
      if (!msg) throw new Error("Mensagem não encontrada.");
      if (!msg.raw) throw new Error("Essa mensagem não tem mídia.");
      const mimetype = msg.media?.mimetype?.split(";")[0] ?? "application/octet-stream";
      const result = await ops.downloadMedia(s.id, { chatJid, messageId: message_id, raw: msg.raw, mimetype, size: msg.media?.size ?? 0 });
      return downloadResult(s.opener, { mediaId: result.mediaId, mimetype, fileName: msg.media?.fileName ?? null, size: result.size });
    }),
  );
}
