import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSendAllowed, PolicyError, recordSend } from "../src/policy.ts";

test("never sends to a chat that does not exist yet", async () => {
  await assert.rejects(checkSendAllowed("s-unknown", { knownChat: false }), PolicyError);
});

test("blocks after 10 sends in a minute", async () => {
  const id = "s-burst";
  for (let i = 0; i < 10; i++) {
    await checkSendAllowed(id, { knownChat: true });
    recordSend(id);
  }
  await assert.rejects(checkSendAllowed(id, { knownChat: true }), /por minuto/);
});

test("limits from the admin page apply, but never past the caps in the image", async () => {
  const low = "s-low";
  for (let i = 0; i < 2; i++) {
    await checkSendAllowed(low, { knownChat: true, limits: { perMinute: 2, perDay: null } });
    recordSend(low);
  }
  await assert.rejects(checkSendAllowed(low, { knownChat: true, limits: { perMinute: 2, perDay: null } }), /2 envios por minuto/);

  const high = "s-high";
  const limits = { perMinute: 10_000, perDay: null };
  for (let i = 0; i < 30; i++) {
    await checkSendAllowed(high, { knownChat: true, limits });
    recordSend(high);
  }
  await assert.rejects(checkSendAllowed(high, { knownChat: true, limits }), /30 envios por minuto/);
});
