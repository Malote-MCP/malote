import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";
import { commands } from "./schema.ts";

type Db = NodePgDatabase<typeof schema>;

export type CommandType = "connect" | "logout" | "send_text" | "send_file" | "download_media";

export type SendTextPayload = { chatJid: string; text: string; replyToId?: string };
export type SendFilePayload = {
  chatJid: string;
  caption?: string;
  // Either an already stored media file or inline base64 content.
  mediaId?: string;
  base64?: string;
  mimetype?: string;
  fileName?: string;
};
export type DownloadMediaPayload = { chatJid: string; messageId: string };

/** Inserts a command; a DB trigger fires NOTIFY so the worker picks it up immediately. */
export async function enqueueCommand(
  db: Db,
  input: { sessionId: string; type: CommandType; payload?: unknown; source: "mcp" | "web" },
) {
  const [row] = await db
    .insert(commands)
    .values({ sessionId: input.sessionId, type: input.type, payload: input.payload ?? {}, source: input.source })
    .returning({ id: commands.id });
  return row.id;
}

/** Polls until the worker finishes the command (or the timeout elapses). */
export async function waitForCommand(db: Db, id: number, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let delay = 150;
  while (Date.now() < deadline) {
    const [row] = await db.select().from(commands).where(eq(commands.id, id)).limit(1);
    if (row && (row.status === "done" || row.status === "error")) return row;
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.5, 1000);
  }
  return null;
}
