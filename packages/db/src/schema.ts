import {
  bigint,
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
  // X25519 public key (base64url). Stored content is encrypted to it; see crypto.ts.
  publicKey: text("public_key"),
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
    // Encrypted (crypto.ts).
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
    // Encrypted (crypto.ts).
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
    // Encrypted (crypto.ts): sender_name, text, media, raw.
    senderName: text("sender_name"),
    fromMe: boolean("from_me").notNull().default(false),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    // text | image | video | audio | document | sticker | location | contact | reaction | poll | other
    type: text("type").notNull(),
    text: text("text"),
    quotedId: text("quoted_id"),
    // JSON { mimetype, fileName, size, seconds }.
    media: text("media"),
    // Full WAMessage (BufferJSON-encoded JSON) so media can be downloaded later.
    raw: text("raw"),
    edited: boolean("edited").notNull().default(false),
    revoked: boolean("revoked").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.chatJid, t.id] }),
    index("messages_chat_ts_idx").on(t.sessionId, t.chatJid, t.ts),
    index("messages_session_ts_idx").on(t.sessionId, t.ts),
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
    // connect | logout | rekey | send_text | send_file | download_media
    type: text("type").notNull(),
    // Wiped when the command finishes; finished rows are deleted shortly after.
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
    // Encrypted (crypto.ts).
    fileName: text("file_name"),
    size: integer("size").notNull(),
    // AES-GCM with the key of epoch `epoch_id`.
    data: bytea("data").notNull(),
    epochId: bigint("epoch_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("media_files_msg_idx").on(t.sessionId, t.chatJid, t.messageId)],
);

/** Ephemeral public keys of the worker's encryption epochs (crypto.ts). */
export const encEpochs = pgTable("enc_epochs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => waSessions.id, { onDelete: "cascade" }),
  epk: text("epk").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * The enclave's HTTPS certificate, so restarts don't hit Let's Encrypt rate limits. `data` is the
 * private key and certificate, AES-GCM encrypted with a key only the attested enclave can fetch.
 */
export const tlsCerts = pgTable("tls_certs", {
  hostname: text("hostname").primaryKey(),
  data: bytea("data").notNull(),
  notAfter: timestamp("not_after", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Image each worker process runs, for the public transparency endpoint. */
export const workers = pgTable("workers", {
  id: text("id").primaryKey(),
  imageRef: text("image_ref"),
  gitSha: text("git_sha"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  seenAt: timestamp("seen_at", { withTimezone: true }).notNull(),
});

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
    // The user's private key, encrypted with a key derived from this token (crypto.ts).
    wrappedKey: text("wrapped_key"),
  },
  (t) => [uniqueIndex("api_tokens_hash_idx").on(t.tokenHash), index("api_tokens_user_idx").on(t.userId)],
);

