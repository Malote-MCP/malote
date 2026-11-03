import {
  adminOverview,
  adminAnalytics,
  adminUserDaily,
  parseAdminFilters,
  adminUsers,
  effectiveSendLimits,
  GLOBAL_LIMITS,
  globalSendLimits,
  SEND_LIMIT_CAPS,
  SEND_LIMIT_DEFAULTS,
} from "@malote/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminAnalytics } from "@/components/admin-analytics";
import { DeleteAccount } from "@/components/admin-delete-account";
import { LimitsForm } from "@/components/admin-limits";
import { Logo } from "@/components/logo";
import { currentAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Admin — Malote",
  robots: { index: false },
};

const statusLabel: Record<string, string> = {
  connected: "Conectado",
  qr: "Aguardando QR",
  pending: "Pendente",
  logged_out: "Desconectado",
  error: "Erro",
};

const num = (n: number) => n.toLocaleString("pt-BR");
const bytes = (b: number) =>
  b < 1024 ** 2
    ? `${num(Math.round(b / 1024))} KB`
    : b < 1024 ** 3
      ? `${num(Math.round(b / 1024 ** 2))} MB`
      : `${(b / 1024 ** 3).toFixed(1)} GB`;
const when = (iso: string | null) => {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 30 * 86400) return `há ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
};

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/70 p-4">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const admin = await currentAdmin();
  if (!admin) notFound();
  let filters;
  let filterError: string | undefined;
  try {
    filters = parseAdminFilters(await searchParams);
  } catch (e) {
    filters = parseAdminFilters({});
    filterError = (e as Error).message;
  }
  const [report, o, allUsers, global] = await Promise.all([
    adminAnalytics(db, filters),
    adminOverview(db),
    adminUsers(db),
    globalSendLimits(db),
  ]);
  const dailyRows = await adminUserDaily(db, filters, report);
  const selectedIds = new Set(report.users.map((u) => u.id));
  const users = allUsers.filter((u) => selectedIds.has(u.id));
  const usageById = new Map(report.users.map((u) => [u.id, u]));
  const effectiveGlobal = effectiveSendLimits(global);
  const connected = o.sessionsByStatus.connected ?? 0;

  // Last 30 days, including days without sign-ups.
  const byDay = new Map(o.signupsByDay.map((d) => [d.day, d.count]));
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(Date.now() - (29 - i) * 86400_000)
      .toISOString()
      .slice(0, 10);
    return { day, count: byDay.get(day) ?? 0 };
  });
  const peak = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href="/app" />
        <span className="rounded-full border border-line px-3 py-1 text-xs text-ink-3">
          Admin
        </span>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-4 sm:px-6">
        <p className="text-sm text-ink-3">
          Só contas, estado da conexão e contagens. Esta página não lê
          mensagens, contatos, telefones nem conversas.
        </p>

        <AdminAnalytics
          report={report}
          rows={dailyRows}
          filters={filters}
          error={filterError}
        />
        <p className="text-xs text-ink-3">
          Visão geral do serviço · indicadores abaixo independem dos filtros.
        </p>
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Usuários"
            value={num(o.users)}
            hint={`+${num(o.usersLast7d)} em 7 dias · +${num(o.usersLast30d)} em 30`}
          />
          <Stat
            label="WhatsApp conectado"
            value={num(connected)}
            hint={`${num(o.sessionsEnabled)} com conexão ligada`}
          />
          <Stat
            label="Tokens ativos"
            value={num(o.activeTokens)}
            hint={`${num(o.tokensUsed24h)} usados em 24 h · ${num(o.tokensUsed7d)} em 7 d`}
          />
          <Stat
            label="Envios pelo Malote"
            value={num(o.sendsToday)}
            hint={`hoje (UTC) · ${num(o.sends7d)} em 7 dias`}
          />
          <Stat label="Aceitaram os termos" value={num(o.acceptedTerms)} />
          <Stat
            label="Mensagens guardadas"
            value={`~${num(o.messagesStored)}`}
            hint="estimativa do Postgres"
          />
          <Stat label="Mídias guardadas" value={bytes(o.mediaBytes)} />
          <Stat
            label="Worker"
            value={o.workers[0]?.gitSha?.slice(0, 7) ?? "—"}
            hint={
              o.workers[0]
                ? `visto ${when(o.workers[0].seenAt)}`
                : "nenhum sinal nas últimas 24 h"
            }
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-3xl border border-line bg-white/70 p-6">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Cadastros nos últimos 30 dias
            </h2>
            <div
              className="mt-5 flex h-32 items-end gap-[3px]"
              role="img"
              aria-label="Cadastros por dia nos últimos 30 dias"
            >
              {days.map((d) => (
                <div key={d.day} className="group relative flex-1">
                  <div
                    className="rounded-t-sm bg-moss/80"
                    style={{
                      height: `${Math.max(d.count ? 4 : 1, (d.count / peak) * 128)}px`,
                    }}
                  />
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-paper group-hover:block">
                    {d.day.slice(8)}/{d.day.slice(5, 7)}: {d.count}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-ink-3">
              <span>
                {days[0].day.slice(8)}/{days[0].day.slice(5, 7)}
              </span>
              <span>hoje</span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {Object.entries(o.sessionsByStatus).map(([s, c]) => (
                <div
                  key={s}
                  className="flex justify-between border-b border-line py-1"
                >
                  <dt className="text-ink-3">{statusLabel[s] ?? s}</dt>
                  <dd className="tabular-nums">{num(c)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-3xl border border-line bg-white/70 p-6">
            <h2 className="font-display text-xl font-semibold tracking-tight">
              Limites de envio
            </h2>
            <p className="mt-1 text-sm text-ink-3">
              Valem para todos que não têm um limite próprio. Vazio usa o padrão
              do código ({SEND_LIMIT_DEFAULTS.perMinute}/min,{" "}
              {SEND_LIMIT_DEFAULTS.perDay}/dia). Agora valendo:{" "}
              <strong>{effectiveGlobal.perMinute}/min</strong> e{" "}
              <strong>{effectiveGlobal.perDay}/dia</strong>.
            </p>
            <div className="mt-5">
              <LimitsForm
                userId={GLOBAL_LIMITS}
                perMinute={global.perMinute}
                perDay={global.perDay}
                caps={SEND_LIMIT_CAPS}
                placeholder={SEND_LIMIT_DEFAULTS}
              />
            </div>
            <p className="mt-5 text-xs leading-relaxed text-ink-3">
              O worker relê os limites a cada 30 s e nunca aceita mais que{" "}
              {SEND_LIMIT_CAPS.perMinute}/min ou {SEND_LIMIT_CAPS.perDay}/dia:
              esse teto está no código auditável da imagem. Para subir o teto é
              preciso publicar uma imagem nova. O contador por minuto e por dia
              fica na memória do worker e zera quando ele reinicia.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white/70 p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Usuários ({num(users.length)})
          </h2>
          <p className="mt-1 text-sm text-ink-3">
            Limite próprio: deixe vazio para usar o padrão.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="py-2 pr-3 font-medium">E-mail</th>
                  <th className="py-2 pr-3 font-medium">Cadastro</th>
                  <th className="py-2 pr-3 font-medium">WhatsApp</th>
                  <th className="py-2 pr-3 font-medium">Visto</th>
                  <th className="py-2 pr-3 font-medium">Tokens</th>
                  <th className="py-2 pr-3 font-medium">Último uso</th>
                  <th className="py-2 pr-3 text-right font-medium">
                    Envios hoje / 7d
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    Envios / dias ativos no período
                  </th>
                  <th className="py-2 font-medium">Limite próprio</th>
                  <th className="py-2 pl-3 font-medium">Conta</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-line/70 align-middle"
                  >
                    <td className="py-2 pr-3">
                      {u.email}
                      {!u.acceptedTerms && (
                        <span className="ml-2 rounded-full bg-paper-2 px-2 py-0.5 text-[10px] text-ink-3">
                          sem aceite
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink-3">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2 pr-3">
                      {u.waStatus ? (
                        <span
                          className={
                            u.waStatus === "connected"
                              ? "text-moss"
                              : u.waStatus === "error"
                                ? "text-clay"
                                : "text-ink-3"
                          }
                        >
                          {statusLabel[u.waStatus] ?? u.waStatus}
                          {!u.waEnabled && u.waStatus !== "logged_out"
                            ? " · desligado"
                            : ""}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-ink-3">
                      {when(u.lastSeenAt)}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{u.activeTokens}</td>
                    <td className="py-2 pr-3 text-ink-3">
                      {when(u.tokenLastUsedAt)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {u.sendsToday} / {u.sends7d}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">
                      {usageById.get(u.id)?.sends ?? 0} /{" "}
                      {usageById.get(u.id)?.activeDays ?? 0}
                    </td>
                    <td className="py-2">
                      <LimitsForm
                        compact
                        userId={u.id}
                        perMinute={u.limitPerMinute}
                        perDay={u.limitPerDay}
                        caps={SEND_LIMIT_CAPS}
                        placeholder={effectiveGlobal}
                      />
                    </td>
                    <td className="py-2 pl-3">
                      <DeleteAccount
                        userId={u.id}
                        email={u.email}
                        disabled={u.id === admin.id}
                      />
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-ink-3">
                      Nenhuma conta para estes filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
