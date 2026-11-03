import ExcelJS from "exceljs";
import type { adminAnalytics, adminUserDaily } from "@malote/db";

export function adminWorkbook(
  report: Awaited<ReturnType<typeof adminAnalytics>>,
  rows: Awaited<ReturnType<typeof adminUserDaily>>,
) {
  const { filters } = report;
  const book = new ExcelJS.Workbook();
  book.creator = "Malote";
  const addSheet = (
    name: string,
    headers: string[],
    data: (string | number | null)[][],
  ) => {
    const sheet = book.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    sheet.addRow(headers);
    // Plain string values are never interpreted as Excel formulas.
    sheet.addRows(data);
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: headers.length },
    };
    sheet.columns.forEach((c, i) => {
      c.width = i === 1 ? 38 : 24;
    });
  };
  addSheet(
    "Resumo",
    ["Indicador", "Valor"],
    [
      ["Início (UTC)", filters.from],
      ["Fim (UTC)", filters.to],
      ["Busca", filters.query],
      ["Status", filters.status],
      ["Atividade", filters.activity],
      ["Contas filtradas", report.summary.users],
      ["Ativos no período", report.summary.activeUsers],
      ["Envios", report.summary.sends],
      ["DAU médio", report.summary.averageDau],
      ["Definição de ativo", report.activeDefinition],
      [
        "Cobertura",
        "Desde a implantação dos contadores. Exclusão de conta remove suas contagens.",
      ],
    ],
  );
  addSheet(
    "Por dia",
    ["Dia (UTC)", "Envios", "DAU"],
    report.daily.map((d) => [d.day, d.sends, d.activeUsers]),
  );
  addSheet(
    "Por usuário",
    [
      "ID",
      "E-mail",
      "Cadastro",
      "WhatsApp",
      "Envios",
      "Dias ativos",
      "Último dia com envio",
    ],
    report.users.map((u) => [
      u.id,
      u.email,
      u.createdAt,
      u.status,
      u.sends,
      u.activeDays,
      u.lastSendDay,
    ]),
  );
  addSheet(
    "Usuário por dia",
    ["Dia (UTC)", "E-mail", "ID", "Envios"],
    rows.map((r) => [r.day, r.email, r.userId, r.sends]),
  );
  return book;
}
