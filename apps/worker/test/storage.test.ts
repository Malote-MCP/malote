// Integration: needs a disposable Postgres in DATABASE_URL_TEST (CI starts one; locally use a Neon branch).
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  createDb,
  createPool,
  encEpochs,
  generateUserKeyPair,
  getMessages,
  listChats,
  loadOpener,
  newEpoch,
  Sealer,
  searchContacts,
  searchMessages,
  waSessions,
} from "@malote/db";
import type { WAMessage } from "baileys";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { encryptLegacy } from "../src/legacy.ts";
import { storeContacts, storeMessages } from "../src/ingest.ts";

const url = process.env.DATABASE_URL_TEST;
const skip = !url && "DATABASE_URL_TEST not set";

const pool = url ? createPool(url, 4) : null!;
const db = url ? createDb(pool) : null!;
const user = generateUserKeyPair();
let sessionId = "";
let sealer: Sealer;

const CHAT = "5511988887777@s.whatsapp.net";
const wa = (id: string, text: string, ts: number, fromMe = false) =>
  ({ key: { remoteJid: CHAT, id, fromMe }, messageTimestamp: ts, pushName: "Rafael", message: { conversation: text } }) as WAMessage;

before(async () => {
  if (!url) return;
  await migrate(drizzle(pool), { migrationsFolder: new URL("../../../packages/db/migrations", import.meta.url).pathname });
  const [s] = await db
    .insert(waSessions)
    .values({ userId: `test-${Date.now()}`, publicKey: user.publicKey })
    .returning({ id: waSessions.id });
  sessionId = s.id;
  const { epk, key } = newEpoch(user.publicKey);
  const [ep] = await db.insert(encEpochs).values({ sessionId, epk }).returning({ id: encEpochs.id });
  sealer = new Sealer(ep.id, key);
});

after(async () => {
  if (!url) return;
  await db.delete(waSessions).where(eq(waSessions.id, sessionId));
  await pool.end();
});

test("new messages are stored encrypted and read back with the user's key", { skip }, async () => {
  await storeMessages(db, sessionId, [wa("M1", "O contrato está em anexo", 1_790_000_000), wa("M2", "valeu!", 1_790_000_100, true)], sealer);
  const { rows } = await pool.query("select text, sender_name from messages where session_id = $1", [sessionId]);
  assert.ok(rows.every((r) => !r.text.includes("contrato") && (r.sender_name == null || !r.sender_name.includes("Rafael"))));

  const o = await loadOpener(db, { id: sessionId, publicKey: user.publicKey }, user.privateKey);
  const msgs = await getMessages(db, o, sessionId, { chatJid: CHAT });
  assert.deepEqual(msgs.map((m) => m.text), ["O contrato está em anexo", "valeu!"]);
  assert.equal(msgs[0].fromName, "Rafael");
  assert.equal(msgs[0].chatName, "Rafael");
});

test("without the key, content comes back empty", { skip }, async () => {
  const o = await loadOpener(db, { id: sessionId, publicKey: user.publicKey }, null);
  const msgs = await getMessages(db, o, sessionId, { chatJid: CHAT });
  assert.ok(msgs.length > 0 && msgs.every((m) => m.text === null && m.chatName === null));
});

test("legacy plaintext rows are encrypted in place", { skip }, async () => {
  await pool.query(
    `insert into messages (session_id, chat_jid, id, sender_name, ts, type, text, media)
     values ($1, $2, 'OLD1', 'Rafael', to_timestamp(1780000000), 'document', 'segue o boleto', '{"fileName":"boleto.pdf"}')`,
    [sessionId, CHAT],
  );
  await pool.query(`insert into contacts (session_id, jid, notify) values ($1, '5511900000000@s.whatsapp.net', 'Bia')`, [sessionId]);
  const n = await encryptLegacy(pool, sessionId, sealer);
  assert.ok(n >= 2);
  const { rows } = await pool.query(
    `select count(*)::int as plain from messages where session_id = $1 and (text not like 'e1:%' or media not like 'e1:%' or sender_name not like 'e1:%')`,
    [sessionId],
  );
  assert.equal(rows[0].plain, 0);
  assert.equal(await encryptLegacy(pool, sessionId, sealer), 0, "second run finds nothing to do");
});

test("search, chat list and contacts work on encrypted data", { skip }, async () => {
  await storeContacts(db, sessionId, [{ id: "5511977776666@s.whatsapp.net", name: "Ana Lúcia" }], sealer);
  const o = await loadOpener(db, { id: sessionId, publicKey: user.publicKey }, user.privateKey);

  const found = await searchMessages(db, o, sessionId, { query: "CONTRATO anexo" });
  assert.deepEqual(found.messages.map((m) => m.id), ["M1"]);
  assert.equal(found.complete, true);
  const byFile = await searchMessages(db, o, sessionId, { query: "boleto.pdf" });
  assert.deepEqual(byFile.messages.map((m) => m.id), ["OLD1"]);

  const chats = await listChats(db, o, sessionId, { query: "rafa" });
  assert.deepEqual(chats.map((c) => c.jid), [CHAT]);

  const people = await searchContacts(db, o, sessionId, { query: "lucia" });
  assert.deepEqual(people.contacts.map((c) => c.name), ["Ana Lúcia"]);
  const legacy = await searchContacts(db, o, sessionId, { query: "bia" });
  assert.deepEqual(legacy.contacts.map((c) => c.name), ["Bia"]);
});
