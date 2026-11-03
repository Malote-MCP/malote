import assert from "node:assert/strict";
import { test } from "node:test";
import { POST } from "../app/api/admin/mcp/route.ts";

test("admin MCP HTTP rejects user tokens and exposes only reporting tools", async () => {
  const previous = process.env.ADMIN_MCP_TOKEN;
  process.env.ADMIN_MCP_TOKEN = "reporting-test-credential-" + "a".repeat(40);
  const request = (bearer?: string) =>
    new Request("http://localhost/api/admin/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-03-26",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
  try {
    assert.equal((await POST(request())).status, 401);
    assert.equal((await POST(request("mlt_regular-user-token"))).status, 401);
    const response = await POST(request(process.env.ADMIN_MCP_TOKEN));
    assert.equal(response.status, 200);
    const body = await response.text();
    const data = JSON.parse(
      body.startsWith("event:")
        ? body
            .split("\n")
            .find((line) => line.startsWith("data: "))!
            .slice(6)
        : body,
    );
    assert.deepEqual(
      data.result.tools.map((t: { name: string }) => t.name).sort(),
      ["admin_analytics", "admin_user_daily"],
    );
    assert.ok(
      data.result.tools.every(
        (t: { annotations: { readOnlyHint: boolean } }) =>
          t.annotations.readOnlyHint,
      ),
    );
  } finally {
    if (previous === undefined) delete process.env.ADMIN_MCP_TOKEN;
    else process.env.ADMIN_MCP_TOKEN = previous;
  }
});
