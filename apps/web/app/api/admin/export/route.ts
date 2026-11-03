import { adminWorkbook } from "@/lib/admin-workbook";
import { adminAnalytics, adminUserDaily, parseAdminFilters } from "@malote/db";
import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await currentAdmin()))
    return Response.json({ error: "Not found" }, { status: 404 });
  let filters;
  try {
    filters = parseAdminFilters(
      Object.fromEntries(new URL(req.url).searchParams),
    );
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const report = await adminAnalytics(db, filters);
  const rows = await adminUserDaily(db, filters, report);
  const book = adminWorkbook(report, rows);
  const buffer = await book.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="malote-${filters.from}-${filters.to}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
