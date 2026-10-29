import { and, desc, eq, gte, lt, lte, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Opener } from "./crypto.ts";
import * as schema from "./schema.ts";
import { chats, contacts, encEpochs, messages, waSessions } from "./schema.ts";

type Db = NodePgDatabase<typeof schema>;

export type MediaInfo = { mimetype?: string; fileName?: string; size?: number; seconds?: number };

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
  media: MediaInfo | null;
  quotedId: string | null;
  edited: boolean;
  revoked: boolean;
};

/** Content is encrypted, so text matching happens here after decrypting: case- and accent-insensitive. */
export function normalizeText(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matcher(query: string) {
  const q = normalizeText(query.trim());
  const phrase = q.match(/^"(.+)"$/)?.[1];
  const terms = phrase ? [phrase] : q.split(/\s+/).filter(Boolean);
  return (...values: (string | null | undefined)[]) => {
    const hay = values.filter(Boolean).map((v) => normalizeText(v!)).join(" ");
    return terms.every((t) => hay.includes(t));
  };
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

function toView(o: Opener, r: MessageRow): MessageView {
  return {
    id: r.id!,
    chat: r.chat!,
    chatName: o.open(r.chatName),
    from: r.fromMe ? "me" : r.from,
    fromName: r.fromMe ? "Eu" : o.open(r.fromName),
    fromMe: !!r.fromMe,
    time: (r.ts as Date).toISOString(),
    type: r.type!,
    text: r.revoked ? null : o.open(r.text),
    media: o.openJson<MediaInfo>(r.media),
    quotedId: r.quotedId,
    edited: !!r.edited,
    revoked: !!r.revoked,
  };
}

export async function getSessionByUserId(db: Db, userId: string) {
  const [row] = await db.select().from(waSessions).where(eq(waSessions.userId, userId)).limit(1);
  return row ?? null;
}

/** Builds a decryptor for a session from the user's private key (unwrapped from their MCP token). */
export async function loadOpener(db: Db, session: { id: string; publicKey: string | null }, privateKey: string | null) {
  const rows = await db.select({ id: encEpochs.id, epk: encEpochs.epk }).from(encEpochs).where(eq(encEpochs.sessionId, session.id));
  return new Opener(privateKey, session.publicKey, new Map(rows.map((r) => [r.id, r.epk])));
}

export async function listChats(db: Db, o: Opener, sessionId: string, opts: { query?: string; limit?: number } = {}) {
  const limit = Math.min(opts.limit ?? 30, 200);
  const rows = await db
    .select({
      jid: chats.jid,
      name: chats.name,
      isGroup: chats.isGroup,
      archived: chats.archived,
      lastMessageAt: chats.lastMessageAt,
    })
    .from(chats)
    .where(eq(chats.sessionId, sessionId))
    .orderBy(sql`${chats.lastMessageAt} desc nulls last`)
    .limit(opts.query ? 100_000 : limit);
  const list = rows.map((r) => ({ ...r, name: o.open(r.name) }));
  if (!opts.query) return list;
  const match = matcher(opts.query);
  return list.filter((c) => match(c.name, c.jid)).slice(0, limit);
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
  o: Opener,
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
  return rows.reverse().map((r) => toView(o, r));
}

/** One message, decrypted, including the raw WAMessage JSON (needed to quote or download it). */
export async function getMessage(db: Db, o: Opener, sessionId: string, chatJid: string, id: string) {
  const [row] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.sessionId, sessionId), eq(messages.chatJid, chatJid), eq(messages.id, id)))
    .limit(1);
  if (!row) return null;
  return {
    ...row,
    senderName: o.open(row.senderName),
    text: o.open(row.text),
    media: o.openJson<MediaInfo>(row.media),
    raw: o.open(row.raw),
  };
}

const SEARCH_PAGE = 10_000;
// Content is encrypted, so search decrypts message by message; stop after this and report how far it got.
const SEARCH_BUDGET_MS = 12_000;

export type SearchResult = {
  messages: MessageView[];
  /** False when the time budget ran out before the whole range was scanned. */
  complete: boolean;
  /** Oldest message time scanned; pass it as `until` to continue further back. */
  scannedUntil: string | null;
};

export async function searchMessages(
  db: Db,
  o: Opener,
  sessionId: string,
  opts: { query: string; chatJid?: string; fromMe?: boolean; since?: string; until?: string; limit?: number },
): Promise<SearchResult> {
  const limit = Math.min(opts.limit ?? 30, 200);
  const match = matcher(opts.query);
  const deadline = Date.now() + SEARCH_BUDGET_MS;
  const conds = [eq(messages.sessionId, sessionId), eq(messages.revoked, false)];
  if (opts.chatJid) conds.push(eq(messages.chatJid, opts.chatJid));
  if (opts.fromMe !== undefined) conds.push(eq(messages.fromMe, opts.fromMe));
  if (opts.since) conds.push(gte(messages.ts, new Date(opts.since)));

  // Newest first with keyset pagination, fetching only what matching needs; full rows only for hits.
  const hits: { chatJid: string; id: string }[] = [];
  let cursor: { ts: Date; chatJid: string; id: string } | null = null;
  let complete = false;
  while (hits.length < limit) {
    const page: SQL[] = [...conds];
    if (cursor) page.push(sql`(${messages.ts}, ${messages.chatJid}, ${messages.id}) < (${cursor.ts}, ${cursor.chatJid}, ${cursor.id})`);
    else if (opts.until) page.push(lte(messages.ts, new Date(opts.until)));
    const rows = await db
      .select({ ts: messages.ts, chatJid: messages.chatJid, id: messages.id, text: messages.text, media: messages.media })
      .from(messages)
      .where(and(...page))
      .orderBy(desc(messages.ts), desc(messages.chatJid), desc(messages.id))
      .limit(SEARCH_PAGE);
    for (const r of rows) {
      cursor = r;
      if (!r.text && !r.media) continue;
      if (match(o.open(r.text), r.media ? o.openJson<MediaInfo>(r.media)?.fileName : null)) hits.push(r);
      if (hits.length >= limit) break;
    }
    if (rows.length < SEARCH_PAGE && hits.length < limit) complete = true;
    if (complete || Date.now() > deadline) break;
  }

  const views = await Promise.all(
    hits.map(async (h) => {
      const [row] = await db
        .select(messageColumns)
        .from(messages)
        .leftJoin(chats, and(eq(chats.sessionId, messages.sessionId), eq(chats.jid, messages.chatJid)))
        .where(and(eq(messages.sessionId, sessionId), eq(messages.chatJid, h.chatJid), eq(messages.id, h.id)))
        .limit(1);
      return toView(o, row);
    }),
  );
  return { messages: views, complete: complete || hits.length >= limit, scannedUntil: cursor?.ts.toISOString() ?? null };
}

export async function searchContacts(db: Db, o: Opener, sessionId: string, opts: { query: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 20, 100);
  const match = matcher(opts.query);
  const people = (
    await db
      .select({ jid: contacts.jid, name: contacts.name, notify: contacts.notify, phone: contacts.phone })
      .from(contacts)
      .where(eq(contacts.sessionId, sessionId))
  )
    .map((p) => ({ jid: p.jid, name: o.open(p.name), notify: o.open(p.notify), phone: p.phone }))
    .filter((p) => match(p.name, p.notify, p.phone, p.jid))
    .slice(0, limit);
  const groups = (
    await db
      .select({ jid: chats.jid, name: chats.name })
      .from(chats)
      .where(and(eq(chats.sessionId, sessionId), eq(chats.isGroup, true)))
  )
    .map((g) => ({ jid: g.jid, name: o.open(g.name) }))
    .filter((g) => match(g.name))
    .slice(0, limit);
  return {
    contacts: people.map((p) => ({ jid: p.jid, name: p.name ?? p.notify, phone: p.phone })),
    groups,
  };
}
