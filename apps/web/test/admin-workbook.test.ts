import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { adminWorkbook } from "../lib/admin-workbook.ts";

test("xlsx round-trip preserves counts and treats formula-like emails as text", async () => {
  const email = '=HYPERLINK("https://example.com")';
  const book = adminWorkbook(
    {
      filters: {
        from: "2026-11-01",
        to: "2026-11-01",
        query: "",
        activity: "",
        status: "",
      },
      timezone: "UTC",
      activeDefinition: "Envio no dia UTC",
      summary: { users: 1, activeUsers: 1, sends: 3, averageDau: 1 },
      daily: [{ day: "2026-11-01", sends: 3, activeUsers: 1 }],
      users: [
        {
          id: "test",
          email,
          createdAt: "2026-11-01",
          status: null,
          sends: 3,
          activeDays: 1,
          lastSendDay: "2026-11-01",
        },
      ],
    },
    [{ day: "2026-11-01", userId: "test", email, sends: 3 }],
  );
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await book.xlsx.writeBuffer());
  assert.equal(loaded.worksheets.length, 4);
  assert.equal(loaded.getWorksheet("Por dia")!.getCell("B2").value, 3);
  assert.equal(loaded.getWorksheet("Por usuário")!.getCell("B2").value, email);
  assert.equal(
    loaded.getWorksheet("Usuário por dia")!.getCell("B2").type,
    ExcelJS.ValueType.String,
  );
});
