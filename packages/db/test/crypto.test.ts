import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateUserKeyPair,
  isSealed,
  newEpoch,
  Opener,
  Sealer,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "../src/crypto.ts";

function setup() {
  const user = generateUserKeyPair();
  const { epk, key } = newEpoch(user.publicKey);
  const sealer = new Sealer(1, key);
  const opener = new Opener(user.privateKey, user.publicKey, new Map([[1, epk]]));
  return { user, epk, sealer, opener };
}

test("sealed strings round-trip and never contain the plaintext", () => {
  const { sealer, opener } = setup();
  const text = "Reunião às 19h com a Ana 🎉";
  const sealed = sealer.seal(text);
  assert.ok(isSealed(sealed));
  assert.ok(!sealed.includes("Ana"));
  assert.equal(opener.open(sealed), text);
});

test("null stays null; legacy plaintext passes through", () => {
  const { sealer, opener } = setup();
  assert.equal(sealer.seal(null), null);
  assert.equal(opener.open(null), null);
  assert.equal(opener.open("texto antigo"), "texto antigo");
});

test("JSON and bytes round-trip", () => {
  const { sealer, opener } = setup();
  const media = { mimetype: "image/jpeg", fileName: "foto.jpg", size: 1234 };
  assert.deepEqual(opener.openJson(sealer.sealJson(media)), media);
  const bytes = Buffer.from([0, 1, 2, 250, 255]);
  assert.deepEqual(opener.openBytes(sealer.sealBytes(bytes), 1), bytes);
});

test("the same plaintext seals differently each time", () => {
  const { sealer } = setup();
  assert.notEqual(sealer.seal("oi"), sealer.seal("oi"));
});

test("another user's key cannot open", () => {
  const { user, epk, sealer } = setup();
  const other = generateUserKeyPair();
  const wrong = new Opener(other.privateKey, user.publicKey, new Map([[1, epk]]));
  assert.equal(wrong.open(sealer.seal("segredo")), null);
});

test("tampered ciphertext is rejected", () => {
  const { sealer, opener } = setup();
  const sealed = sealer.seal("segredo");
  const raw = Buffer.from(sealed.split(":")[2], "base64");
  raw[raw.length - 1] ^= 1;
  assert.equal(opener.open(`e1:1:${raw.toString("base64")}`), null);
});

test("without the private key nothing opens", () => {
  const { user, epk, sealer } = setup();
  const keyless = new Opener(null, user.publicKey, new Map([[1, epk]]));
  assert.equal(keyless.open(sealer.seal("segredo")), null);
});

test("an unknown epoch cannot be opened", () => {
  const { user, sealer } = setup();
  const noEpochs = new Opener(user.privateKey, user.publicKey, new Map());
  assert.equal(noEpochs.open(sealer.seal("segredo")), null);
});

test("token wrapping: right token unwraps, any other token fails", () => {
  const { privateKey } = generateUserKeyPair();
  const token = "mlt_" + "a".repeat(32);
  const wrapped = wrapPrivateKey(privateKey, token);
  assert.ok(!wrapped.includes(privateKey));
  assert.equal(unwrapPrivateKey(wrapped, token), privateKey);
  assert.throws(() => unwrapPrivateKey(wrapped, token + "b"));
});
