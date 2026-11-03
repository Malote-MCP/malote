import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyAdminMcpToken } from "../lib/admin-mcp-auth.ts";

test("admin MCP requires the separate configured reporting credential", () => {
  const secret = "a".repeat(64);
  assert.equal(verifyAdminMcpToken(secret, secret), true);
  assert.equal(verifyAdminMcpToken(undefined, secret), false);
  assert.equal(verifyAdminMcpToken("mlt_regular-user-token", secret), false);
  assert.equal(verifyAdminMcpToken(secret, ""), false);
  assert.equal(verifyAdminMcpToken("short", "short"), false);
  assert.equal(verifyAdminMcpToken("b".repeat(64), secret), false);
});
