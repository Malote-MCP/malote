import { and, desc, eq, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema.ts";
import { chats, contacts, messages, waSessions } from "./schema.ts";

type Db = NodePgDatabase<typeof schema>;

export type MessageView = {
  id: string;
  chat: string;
  chatName: string | null;
  from: string | null;
  fromName: string | null;
  fromMe: boolean;
  time: string;
  type: string;
  text: string | null;
  media: { mimetype?: string; fileName?: string; size?: number; seconds?: number } | null;
  quotedId: string | null;
  edited: boolean;
  revoked: boolean;
};

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const messageColumns = {
  id: messages.id,
  chat: messages.chatJid,
  chatName: chats.name,
  from: messages.senderJid,
  fromName: messages.senderName,
  fromMe: messages.fromMe,
  ts: messages.ts,
  type: messages.type,
  text: messages.text,
  media: messages.media,
  quotedId: messages.quotedId,
  edited: messages.edited,
  revoked: messages.revoked,
};

type MessageRow = {
  [K in keyof typeof messageColumns]: (typeof messageColumns)[K]["_"]["data"] | null;
};

function toView(r: MessageRow): MessageView {
  return {
    id: r.id!,
    chat: r.chat!,
    chatName: r.chatName,
    from: r.fromMe ? "me" : r.from,
    fromName: r.fromMe ? "Eu" : r.fromName,
    fromMe: !!r.fromMe,
    time: (r.ts as Date).toISOString(),
    type: r.type!,
    text: r.revoked ? null : r.text,
    media: r.media,
    quotedId: r.quotedId,
    edited: !!r.edited,
    revoked: !!r.revoked,
  };
}

export async function getSessionByUserId(db: Db, userId: string) {
  const [row] = await db.select().from(waSessions).where(eq(waSessions.userId, userId)).limit(1);
  return row ?? null;
}

export async function listChats(db: Db, sessionId: string, opts: { query?: string; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 30, 200);
  const where = opts.query
    ? and(
        eq(chats.sessionId, sessionId),
        or(ilike(chats.name, `%${escapeLike(opts.query)}%`), ilike(chats.jid, `%${escapeLike(opts.query)}%`)),
      )
    : eq(chats.sessionId, sessionId);
  return db
    .select({
      jid: chats.jid,
      name: chats.name,
      isGroup: chats.isGroup,
      archived: chats.archived,
      lastMessageAt: chats.lastMessageAt,
    })
    .from(chats)
    .where(where)
    .orderBy(sql`${chats.lastMessageAt} desc nulls last`)
    .limit(limit);
}

export async function getChat(db: Db, sessionId: string, jid: string) {
  const [row] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.sessionId, sessionId), eq(chats.jid, jid)))
    .limit(1);
  return row ?? null;
}

export async function getMessages(
  db: Db,
  sessionId: string,
  opts: { chatJid: string; limit?: number; before?: string },
): Promise<MessageView[]> {
  const limit = Math.min(opts.limit ?? 30, 200);
  const conds = [eq(messages.sessionId, sessionId), eq(messages.chatJid, opts.chatJid)];
  if (opts.before) conds.push(lt(messages.ts, new Date(opts.before)));
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(chats, and(eq(chats.sessionId, messages.sessionId), eq(chats.jid, messages.chatJid)))
    .where(and(...conds))
    .orderBy(desc(messages.ts))
    .limit(limit);
  return rows.reverse().map(toView);
}

export async function getMessage(db: Db, sessionId: string, chatJid: string, id: string) {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.chatJid, chatJid), eq(messages.id, id)))
    .limit(1);
  return row ?? null;
}

export async function searchMessages(
  db: Db,
  sessionId: string,
  opts: { query: string; chatJid?: string; fromMe?: boolean; since?: string; until?: string; limit?: number },
): Promise<MessageView[]> {
  const limit = Math.min(opts.limit ?? 30, 200);
  const conds = [
    eq(messages.sessionId, sessionId),
    or(
      sql`${messages.tsv} @@ websearch_to_tsquery('portuguese', ${opts.query})`,
      ilike(messages.text, `%${escapeLike(opts.query)}%`),
    ),
  ];
  if (opts.chatJid) conds.push(eq(messages.chatJid, opts.chatJid));
  if (opts.fromMe !== undefined) conds.push(eq(messages.fromMe, opts.fromMe));
  if (opts.since) conds.push(gte(messages.ts, new Date(opts.since)));
  if (opts.until) conds.push(lte(messages.ts, new Date(opts.until)));
  const rows = await db
    .select(messageColumns)
    .from(messages)
    .leftJoin(chats, and(eq(chats.sessionId, messages.sessionId), eq(chats.jid, messages.chatJid)))
    .where(and(...conds))
    .orderBy(desc(messages.ts))
    .limit(limit);
  return rows.map(toView);
}

export async function searchContacts(db: Db, sessionId: string, opts: { query: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const q = `%${escapeLike(opts.query)}%`;
  const people = await db
    .select({ jid: contacts.jid, name: contacts.name, notify: contacts.notify, phone: contacts.phone })
    .from(contacts)
    .where(
      and(
        eq(contacts.sessionId, sessionId),
        or(ilike(contacts.name, q), ilike(contacts.notify, q), ilike(contacts.phone, q), ilike(contacts.jid, q)),
      ),
    )
    .limit(limit);
  const groups = await db
    .select({ jid: chats.jid, name: chats.name })
    .from(chats)
    .where(and(eq(chats.sessionId, sessionId), eq(chats.isGroup, true), ilike(chats.name, q)))
    .limit(limit);
  return {
    contacts: people.map((p) => ({ jid: p.jid, name: p.name ?? p.notify, phone: p.phone })),
    groups,
  };
}
