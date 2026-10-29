import assert from "node:assert/strict";
import { test } from "node:test";
import type { WAMessage } from "baileys";
import { chatJidOf, isIgnoredJid, parseMessage } from "../src/ingest.ts";

const S = "00000000-0000-0000-0000-000000000001";

function msg(partial: Partial<WAMessage> & { message: WAMessage["message"] }): WAMessage {
  return {
    key: { remoteJid: "5511999990000@s.whatsapp.net", id: "ABC", fromMe: false },
    messageTimestamp: 1_790_000_000,
    pushName: "Ana",
    ...partial,
  } as WAMessage;
}

test("plain text message", () => {
  const p = parseMessage(S, msg({ message: { conversation: "oi tudo bem?" } }));
  assert.equal(p.kind, "message");
  if (p.kind !== "message") return;
  assert.equal(p.row.type, "text");
  assert.equal(p.row.text, "oi tudo bem?");
  assert.equal(p.row.senderName, "Ana");
  assert.equal(p.row.chatJid, "5511999990000@s.whatsapp.net");
  assert.equal(p.row.raw, null);
  assert.equal(p.row.ts.toISOString(), new Date(1_790_000_000_000).toISOString());
});

test("image keeps caption, media info and raw for later download", () => {
  const p = parseMessage(
    S,
    msg({ message: { imageMessage: { caption: "olha isso", mimetype: "image/jpeg", fileLength: 2048 } } }),
  );
  assert.equal(p.kind, "message");
  if (p.kind !== "message") return;
  assert.equal(p.row.type, "image");
  assert.equal(p.row.text, "olha isso");
  assert.deepEqual(p.row.media, { mimetype: "image/jpeg", size: 2048 });
  assert.ok(p.row.raw && JSON.parse(p.row.raw).key.id === "ABC");
});

test("reply records the quoted message id", () => {
  const p = parseMessage(
    S,
    msg({ message: { extendedTextMessage: { text: "sim", contextInfo: { stanzaId: "QUOTED1" } } } }),
  );
  assert.ok(p.kind === "message" && p.row.quotedId === "QUOTED1");
});

test("edit and revoke protocol messages", () => {
  const edit = parseMessage(
    S,
    msg({
      message: {
        protocolMessage: { type: 14, key: { id: "OLD" }, editedMessage: { conversation: "texto corrigido" } },
      },
    }),
  );
  assert.deepEqual(edit, { kind: "edit", chatJid: "5511999990000@s.whatsapp.net", id: "OLD", text: "texto corrigido" });
  const revoke = parseMessage(S, msg({ message: { protocolMessage: { type: 0, key: { id: "OLD" } } } }));
  assert.deepEqual(revoke, { kind: "revoke", chatJid: "5511999990000@s.whatsapp.net", id: "OLD" });
});

test("status broadcasts, newsletters and reactions are skipped", () => {
  assert.ok(isIgnoredJid("status@broadcast"));
  assert.ok(isIgnoredJid("123@newsletter"));
  const status = parseMessage(S, msg({ key: { remoteJid: "status@broadcast", id: "X" }, message: { conversation: "x" } }));
  assert.equal(status.kind, "skip");
  const reaction = parseMessage(S, msg({ message: { reactionMessage: { text: "👍", key: { id: "Y" } } } }));
  assert.equal(reaction.kind, "skip");
});

test("prefers the phone-number JID over the LID", () => {
  assert.equal(
    chatJidOf({ remoteJid: "123456789@lid", remoteJidAlt: "5511999990000@s.whatsapp.net", id: "Z" }),
    "5511999990000@s.whatsapp.net",
  );
  assert.equal(chatJidOf({ remoteJid: "120363000000000000@g.us", id: "Z" }), "120363000000000000@g.us");
});
