import { chats, contacts, messages, type Db } from "@malote/db";
import {
  BufferJSON,
  getContentType,
  isJidGroup,
  isLidUser,
  jidNormalizedUser,
  normalizeMessageContent,
  proto,
  type Chat,
  type Contact,
  type WAMessage,
  type WAMessageKey,
} from "baileys";
import { and, eq, sql } from "drizzle-orm";

type MessageRow = typeof messages.$inferInsert;

/** Prefer the phone-number JID over the LID so a conversation keeps one id. */
export function chatJidOf(key: WAMessageKey) {
  const jid = key.remoteJid ?? "";
  if (isLidUser(jid) && key.remoteJidAlt && !isLidUser(key.remoteJidAlt)) return jidNormalizedUser(key.remoteJidAlt);
  return isJidGroup(jid) ? jid : jidNormalizedUser(jid);
}

function senderJidOf(key: WAMessageKey) {
  const p = key.participant;
  if (!p) return key.fromMe ? null : chatJidOf(key);
  if (isLidUser(p) && key.participantAlt && !isLidUser(key.participantAlt)) return jidNormalizedUser(key.participantAlt);
  return jidNormalizedUser(p);
}

function toDate(ts: WAMessage["messageTimestamp"]) {
  const n = typeof ts === "number" ? ts : ts ? Number(ts) : Math.floor(Date.now() / 1000);
  return new Date(n * 1000);
}

/** Chats we never want to store (status broadcast, newsletters). */
export function isIgnoredJid(jid: string | null | undefined) {
  return !jid || jid === "status@broadcast" || jid.endsWith("@newsletter") || jid.endsWith("@broadcast");
}

export type ParsedMessage =
  | { kind: "message"; row: MessageRow }
  | { kind: "edit"; chatJid: string; id: string; text: string | null }
  | { kind: "revoke"; chatJid: string; id: string }
  | { kind: "skip" };

export function parseMessage(sessionId: string, msg: WAMessage): ParsedMessage {
  const key = msg.key;
  if (!key?.id || isIgnoredJid(key.remoteJid)) return { kind: "skip" };
  const content = normalizeMessageContent(msg.message);
  if (!content) return { kind: "skip" };
  const type = getContentType(content);
  const chatJid = chatJidOf(key);

  if (type === "protocolMessage") {
    const pm = content.protocolMessage!;
    const targetId = pm.key?.id;
    if (!targetId) return { kind: "skip" };
    if (pm.type === proto.Message.ProtocolMessage.Type.REVOKE) return { kind: "revoke", chatJid, id: targetId };
    if (pm.type === proto.Message.ProtocolMessage.Type.MESSAGE_EDIT) {
      const edited = normalizeMessageContent(pm.editedMessage);
      return { kind: "edit", chatJid, id: targetId, text: textOf(edited) };
    }
    return { kind: "skip" };
  }
  if (!type || type === "senderKeyDistributionMessage" || type === "messageContextInfo" || type === "reactionMessage") {
    return { kind: "skip" };
  }

  let kind = "other";
  let media: MessageRow["media"] = null;
  const m = content;
  switch (type) {
    case "conversation":
    case "extendedTextMessage":
      kind = "text";
      break;
    case "imageMessage":
      kind = "image";
      media = { mimetype: m.imageMessage?.mimetype ?? undefined, size: Number(m.imageMessage?.fileLength ?? 0) };
      break;
    case "videoMessage":
      kind = "video";
      media = {
        mimetype: m.videoMessage?.mimetype ?? undefined,
        size: Number(m.videoMessage?.fileLength ?? 0),
        seconds: m.videoMessage?.seconds ?? undefined,
      };
      break;
    case "audioMessage":
      kind = "audio";
      media = {
        mimetype: m.audioMessage?.mimetype ?? undefined,
        size: Number(m.audioMessage?.fileLength ?? 0),
        seconds: m.audioMessage?.seconds ?? undefined,
      };
      break;
    case "documentMessage":
      kind = "document";
      media = {
        mimetype: m.documentMessage?.mimetype ?? undefined,
        fileName: m.documentMessage?.fileName ?? undefined,
        size: Number(m.documentMessage?.fileLength ?? 0),
      };
      break;
    case "stickerMessage":
      kind = "sticker";
      media = { mimetype: m.stickerMessage?.mimetype ?? undefined };
      break;
    case "locationMessage":
    case "liveLocationMessage":
      kind = "location";
      break;
    case "contactMessage":
    case "contactsArrayMessage":
      kind = "contact";
      break;
    case "pollCreationMessage":
    case "pollCreationMessageV2":
    case "pollCreationMessageV3":
      kind = "poll";
      break;
  }

  const contextInfo =
    m.extendedTextMessage?.contextInfo ??
    m.imageMessage?.contextInfo ??
    m.videoMessage?.contextInfo ??
    m.documentMessage?.contextInfo ??
    m.audioMessage?.contextInfo ??
    null;

  return {
    kind: "message",
    row: {
      sessionId,
      chatJid,
      id: key.id,
      senderJid: senderJidOf(key),
      senderName: key.fromMe ? null : (msg.pushName ?? null),
      fromMe: !!key.fromMe,
      ts: toDate(msg.messageTimestamp),
      type: kind,
      text: textOf(content),
      quotedId: contextInfo?.stanzaId ?? null,
      media,
      // Only media messages need the raw payload (for later download).
      raw: media ? JSON.parse(JSON.stringify(msg, BufferJSON.replacer)) : null,
    },
  };
}

export function textOf(m: proto.IMessage | undefined | null): string | null {
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    (m.locationMessage
      ? `[localização] ${m.locationMessage.name ?? ""} ${m.locationMessage.degreesLatitude},${m.locationMessage.degreesLongitude}`.trim()
      : null) ??
    (m.contactMessage ? `[contato] ${m.contactMessage.displayName ?? ""}` : null) ??
    (m.pollCreationMessageV3?.name ?? m.pollCreationMessage?.name ?? m.pollCreationMessageV2?.name
      ? `[enquete] ${m.pollCreationMessageV3?.name ?? m.pollCreationMessage?.name ?? m.pollCreationMessageV2?.name}`
      : null) ??
    null
  );
}

const CHUNK = 500;

export async function storeMessages(db: Db, sessionId: string, msgs: WAMessage[]) {
  const rows: MessageRow[] = [];
  const edits: Extract<ParsedMessage, { kind: "edit" }>[] = [];
  const revokes: Extract<ParsedMessage, { kind: "revoke" }>[] = [];
  for (const msg of msgs) {
    const parsed = parseMessage(sessionId, msg);
    if (parsed.kind === "message") rows.push(parsed.row);
    else if (parsed.kind === "edit") edits.push(parsed);
    else if (parsed.kind === "revoke") revokes.push(parsed);
  }

  for (let i = 0; i < rows.length; i += CHUNK) {
    await db.insert(messages).values(rows.slice(i, i + CHUNK)).onConflictDoNothing();
  }

  // Bump chats' last activity and create chats we haven't seen yet.
  const latest = new Map<string, Date>();
  for (const r of rows) {
    const prev = latest.get(r.chatJid);
    if (!prev || r.ts > prev) latest.set(r.chatJid, r.ts);
  }
  const chatRows = [...latest].map(([jid, ts]) => ({
    sessionId,
    jid,
    isGroup: !!isJidGroup(jid),
    lastMessageAt: ts,
    // For 1:1 chats, use the other person's push name as a fallback chat name.
    name: isJidGroup(jid) ? null : (rows.find((r) => r.chatJid === jid && !r.fromMe && r.senderName)?.senderName ?? null),
  }));
  if (chatRows.length) {
    await db
      .insert(chats)
      .values(chatRows)
      .onConflictDoUpdate({
        target: [chats.sessionId, chats.jid],
        set: {
          lastMessageAt: sql`greatest(${chats.lastMessageAt}, excluded.last_message_at)`,
          name: sql`coalesce(${chats.name}, excluded.name)`,
        },
      });
  }

  // Remember push names of senders as contacts.
  const senders = new Map<string, string>();
  for (const r of rows) if (r.senderJid && r.senderName && !r.fromMe) senders.set(r.senderJid, r.senderName);
  if (senders.size) {
    await db
      .insert(contacts)
      .values([...senders].map(([jid, notify]) => ({ sessionId, jid, notify, phone: phoneOf(jid) })))
      .onConflictDoUpdate({ target: [contacts.sessionId, contacts.jid], set: { notify: sql`excluded.notify` } });
  }

  for (const e of edits) {
    await db
      .update(messages)
      .set({ text: e.text, edited: true })
      .where(and(eq(messages.sessionId, sessionId), eq(messages.chatJid, e.chatJid), eq(messages.id, e.id)));
  }
  for (const r of revokes) {
    await db
      .update(messages)
      .set({ revoked: true })
      .where(and(eq(messages.sessionId, sessionId), eq(messages.chatJid, r.chatJid), eq(messages.id, r.id)));
  }
  return rows;
}

function phoneOf(jid: string) {
  return jid.endsWith("@s.whatsapp.net") ? jid.split("@")[0].split(":")[0] : null;
}

export async function storeChats(db: Db, sessionId: string, list: (Chat | Partial<Chat>)[]) {
  const rows = list
    .filter((c) => c.id && !isIgnoredJid(c.id))
    .map((c) => ({
      sessionId,
      jid: isJidGroup(c.id!) ? c.id! : jidNormalizedUser(c.id!),
      name: c.name ?? null,
      isGroup: !!isJidGroup(c.id!),
      archived: !!c.archived,
      lastMessageAt: c.conversationTimestamp ? new Date(Number(c.conversationTimestamp) * 1000) : null,
    }));
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(chats)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [chats.sessionId, chats.jid],
        set: {
          name: sql`coalesce(excluded.name, ${chats.name})`,
          archived: sql`excluded.archived`,
          lastMessageAt: sql`greatest(${chats.lastMessageAt}, excluded.last_message_at)`,
        },
      });
  }
}

export async function storeContacts(db: Db, sessionId: string, list: Partial<Contact>[]) {
  const rows = list
    .filter((c) => c.id)
    .map((c) => {
      const pn = c.phoneNumber ?? (!isLidUser(c.id!) ? c.id! : null);
      const jid = pn ? jidNormalizedUser(pn) : c.id!;
      return {
        sessionId,
        jid,
        lid: c.lid ?? (isLidUser(c.id!) ? c.id! : null),
        phone: pn ? phoneOf(jidNormalizedUser(pn)) : null,
        name: c.name ?? null,
        notify: c.notify ?? c.verifiedName ?? null,
      };
    });
  for (let i = 0; i < rows.length; i += CHUNK) {
    await db
      .insert(contacts)
      .values(rows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [contacts.sessionId, contacts.jid],
        set: {
          lid: sql`coalesce(excluded.lid, ${contacts.lid})`,
          phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
          name: sql`coalesce(excluded.name, ${contacts.name})`,
          notify: sql`coalesce(excluded.notify, ${contacts.notify})`,
        },
      });
  }
}

export async function setChatName(db: Db, sessionId: string, jid: string, name: string) {
  await db
    .insert(chats)
    .values({ sessionId, jid, name, isGroup: !!isJidGroup(jid) })
    .onConflictDoUpdate({ target: [chats.sessionId, chats.jid], set: { name } });
}
