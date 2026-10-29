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
