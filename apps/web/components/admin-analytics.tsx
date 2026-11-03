import type { adminAnalytics, adminUserDaily, AdminFilters } from "@malote/db";

type Report = Awaited<ReturnType<typeof adminAnalytics>>;
export function AdminAnalytics({
  report,
  rows,
  filters,
  error,
}: {
  report: Report;
  rows: Awaited<ReturnType<typeof adminUserDaily>>;
  filters: AdminFilters;
  error?: string;
}) {
  const input = "rounded-lg border border-line bg-white px-3 py-2 text-sm";
  const params = new URLSearchParams(filters);
  return (
    <section className="space-y-5 rounded-3xl border border-line bg-white/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Uso do Malote</h1>
        <a
          href={`/api/admin/export?${params}`}
          className="rounded-full bg-moss px-4 py-2 text-sm text-paper"
        >
          Exportar Excel (.xlsx)
        </a>
      </div>
      <form action="/admin" className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs">
          De (UTC)
          <input
            className={input}
            type="date"
            name="from"
            defaultValue={filters.from}
            required
          />
        </label>
        <label className="grid gap-1 text-xs">
          Até (UTC)
          <input
            className={input}
            type="date"
            name="to"
            defaultValue={filters.to}
            required
          />
        </label>
        <label className="grid gap-1 text-xs">
          Conta
          <input
            className={input}
            name="query"
            placeholder="E-mail ou ID"
            defaultValue={filters.query}
          />
        </label>
        <label className="grid gap-1 text-xs">
          WhatsApp
          <select className={input} name="status" defaultValue={filters.status}>
            <option value="">Todos</option>
            <option value="connected">Conectado</option>
            <option value="logged_out">Desconectado</option>
            <option value="qr">Aguardando QR</option>
            <option value="pending">Pendente</option>
            <option value="error">Erro</option>
            <option value="none">Sem sessão</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs">
          Envios no período
          <select
            className={input}
            name="activity"
            defaultValue={filters.activity}
          >
            <option value="">Todos</option>
            <option value="active">Com envios</option>
            <option value="inactive">Sem envios</option>
          </select>
        </label>
        <button className="rounded-full bg-moss px-4 py-2 text-sm text-paper">
          Aplicar filtros
        </button>
        <a href="/admin" className="text-sm underline">
          Limpar
        </a>
      </form>
      {error && (
        <p role="alert" className="text-sm text-clay">
          {error}
        </p>
      )}
      <p className="text-xs text-ink-3">
        Ativo = pelo menos um envio bem-sucedido de texto ou arquivo pelo Malote
        no dia. Dias em UTC. Leituras e mensagens enviadas diretamente no
        WhatsApp não entram. Histórico disponível desde a implantação dos
        contadores; excluir uma conta também remove suas contagens.
      </p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Contas filtradas", report.summary.users],
          ["Ativos no período", report.summary.activeUsers],
          ["Envios no período", report.summary.sends],
          ["DAU médio no período", report.summary.averageDau],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line p-4">
            <p className="text-xs text-ink-3">{label}</p>
            <p className="mt-1 text-2xl tabular-nums">
              {Number(value).toLocaleString("pt-BR", {
                maximumFractionDigits: 1,
              })}
            </p>
          </div>
        ))}
      </div>
      <details open>
        <summary className="cursor-pointer font-medium">
          Envios e usuários ativos por dia
        </summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Dia (UTC)</th>
                <th>Envios</th>
                <th>DAU</th>
              </tr>
            </thead>
            <tbody>
              {[...report.daily].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line">
                  <td className="p-2">{d.day}</td>
                  <td>{d.sends}</td>
                  <td>{d.activeUsers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">
          Envios por usuário e dia ({rows.length})
        </summary>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-2">Dia (UTC)</th>
                <th>E-mail</th>
                <th>Envios</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.day}:${r.userId}`}
                  className="border-t border-line"
                >
                  <td className="p-2">{r.day}</td>
                  <td>{r.email}</td>
                  <td>{r.sends}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className="p-3 text-sm">
              Nenhum envio no período para estes filtros.
            </p>
          )}
        </div>
      </details>
      <details>
        <summary className="cursor-pointer font-medium">
          Conectar análises via MCP
        </summary>
        <p className="mt-2 text-sm text-ink-3">
          Endpoint: /api/admin/mcp neste site. Configure ADMIN_MCP_TOKEN no
          servidor e use essa credencial como Bearer no cliente MCP. Ferramentas
          de consulta: admin_analytics e admin_user_daily. Aceitam os mesmos
          filtros desta página. A credencial dá acesso aos e-mails e às métricas
          de todas as contas; guarde-a como senha.
        </p>
      </details>
    </section>
  );
}
