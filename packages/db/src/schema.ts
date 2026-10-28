import { sql, type SQL } from "drizzle-orm";
import {
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const tsvector = customType<{ data: string }>({
  dataType: () => "tsvector",
});

/** One WhatsApp connection per Malote user (Neon Auth user id). */
export const waSessions = pgTable("wa_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  // Whether the user wants this session connected. The worker only runs enabled sessions.
  enabled: boolean("enabled").notNull().default(false),
  // pending | qr | connected | logged_out | error
  status: text("status").notNull().default("pending"),
  qr: text("qr"),
  qrUpdatedAt: timestamp("qr_updated_at", { withTimezone: true }),
  phone: text("phone"),
  waJid: text("wa_jid"),
  waLid: text("wa_lid"),
  pushName: text("push_name"),
  egressIp: text("egress_ip"),
  workerId: text("worker_id"),
  lastError: text("last_error"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Baileys auth state (creds + signal keys), AES-256-GCM encrypted by the worker. */
export const waAuth = pgTable(
  "wa_auth",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => waSessions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.key] })],
);

export const chats = pgTable(
  "chats",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => waSessions.id, { onDelete: "cascade" }),
    jid: text("jid").notNull(),
    name: text("name"),
    isGroup: boolean("is_group").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.jid] }),
    index("chats_recent_idx").on(t.sessionId, t.lastMessageAt),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => waSessions.id, { onDelete: "cascade" }),
    jid: text("jid").notNull(),
    lid: text("lid"),
    phone: text("phone"),
    name: text("name"),
    notify: text("notify"),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.jid] }), index("contacts_lid_idx").on(t.sessionId, t.lid)],
);

export const messages = pgTable(
  "messages",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => waSessions.id, { onDelete: "cascade" }),
    chatJid: text("chat_jid").notNull(),
    id: text("id").notNull(),
    senderJid: text("sender_jid"),
    senderName: text("sender_name"),
    fromMe: boolean("from_me").notNull().default(false),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    // text | image | video | audio | document | sticker | location | contact | reaction | poll | other
    type: text("type").notNull(),
    text: text("text"),
    quotedId: text("quoted_id"),
    media: jsonb("media").$type<{ mimetype?: string; fileName?: string; size?: number; seconds?: number }>(),
    // Full WAMessage (BufferJSON-encoded) so media can be downloaded later.
    raw: jsonb("raw"),
    edited: boolean("edited").notNull().default(false),
    revoked: boolean("revoked").notNull().default(false),
    tsv: tsvector("tsv").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('portuguese', coalesce(${messages.text}, ''))`,
    ),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.chatJid, t.id] }),
    index("messages_chat_ts_idx").on(t.sessionId, t.chatJid, t.ts),
    index("messages_session_ts_idx").on(t.sessionId, t.ts),
    index("messages_tsv_idx").using("gin", t.tsv),
  ],
);

/** Work queue from the web app / MCP to the worker (send, download, connect, logout). */
export const commands = pgTable(
  "commands",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => waSessions.id, { onDelete: "cascade" }),
    // connect | logout | send_text | send_file | download_media
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default({}),
    // mcp | web
    source: text("source").notNull(),
    // pending | running | done | error
    status: text("status").notNull().default("pending"),
    result: jsonb("result"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("commands_pending_idx").on(t.status, t.createdAt)],
);

export const mediaFiles = pgTable(
  "media_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => waSessions.id, { onDelete: "cascade" }),
    chatJid: text("chat_jid"),
    messageId: text("message_id"),
    mimetype: text("mimetype").notNull(),
    fileName: text("file_name"),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_files_msg_idx").on(t.sessionId, t.chatJid, t.messageId)],
);

/** Bearer tokens for MCP clients. Only the SHA-256 hash is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("api_tokens_hash_idx").on(t.tokenHash), index("api_tokens_user_idx").on(t.userId)],
);

