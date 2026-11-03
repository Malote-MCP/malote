import { sql } from "drizzle-orm";
import type { Db } from "./index.ts";

export type AdminFilters = {
  from: string;
  to: string;
  query: string;
  status: string;
  activity: string;
};

export function parseAdminFilters(
  input: Record<string, unknown>,
  now = new Date(),
): AdminFilters {
  const date = (value: unknown, fallback: string) => {
    if (value === undefined || value === "") return fallback;
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString().slice(0, 10) !== value
    ) {
      throw new Error("Data inválida. Use AAAA-MM-DD.");
    }
    return value;
  };
  const from = date(
    input.from,
    new Date(now.getTime() - 29 * 86400_000).toISOString().slice(0, 10),
  );
  const to = date(input.to, now.toISOString().slice(0, 10));
  if (from > to || Date.parse(to) - Date.parse(from) > 365 * 86400_000) {
    throw new Error(
      "Selecione um período de até 366 dias, com início anterior ao fim.",
    );
  }
  const status = String(input.status ?? "");
  const activity = String(input.activity ?? "");
  if (
    !["", "connected", "qr", "pending", "logged_out", "error", "none"].includes(
      status,
    )
  )
    throw new Error("Status inválido.");
  if (!["", "active", "inactive"].includes(activity))
    throw new Error("Atividade inválida.");
  return {
    from,
    to,
    query: String(input.query ?? "")
      .trim()
      .slice(0, 200),
    status,
    activity,
  };
}

/** Metadata only. Active means at least one successful send through Malote in a UTC day. */
export async function adminAnalytics(db: Db, filters: AdminFilters) {
  const { from, to, query, status, activity } = filters;
  const cohort = sql`with usage as (
    select session_id, sum(count)::bigint as sends, count(*) filter (where count > 0)::int as active_days,
      max(day) filter (where count > 0) as last_send_day
    from send_counts where day >= ${from} and day <= ${to} group by session_id
  ), cohort as (
    select u.id::text as id, u.email, u."createdAt" as created_at, s.id as session_id,
      s.status, coalesce(usage.sends, 0) as sends, coalesce(usage.active_days, 0) as active_days, usage.last_send_day
    from neon_auth."user" u
    left join wa_sessions s on s.user_id = u.id::text
    left join usage on usage.session_id = s.id
    where (${query} = '' or strpos(lower(u.email), lower(${query})) > 0 or u.id::text = ${query})
      and (${status} = '' or (${status} = 'none' and s.id is null) or s.status = ${status})
      and (${activity} = '' or (${activity} = 'active' and coalesce(usage.sends, 0) > 0)
        or (${activity} = 'inactive' and coalesce(usage.sends, 0) = 0))
  )`;
  // One statement gives the summary, daily series and users the same database snapshot.
  const [result] = (
    await db.execute(sql`${cohort}
    select
      (select coalesce(json_agg(r order by r.sends desc, r.email), '[]'::json) from
        (select id, email, created_at, status, sends, active_days, last_send_day from cohort) r) as users,
      (select coalesce(json_agg(r order by r.day), '[]'::json) from (
        select to_char(d.day, 'YYYY-MM-DD') as day, coalesce(sum(c.count), 0)::bigint as sends,
          count(distinct c.session_id) filter (where c.count > 0)::int as active_users
        from generate_series(${from}::date, ${to}::date, interval '1 day') d(day)
        left join send_counts c on c.day = to_char(d.day, 'YYYY-MM-DD')
          and c.session_id in (select session_id from cohort)
        group by d.day
      ) r) as daily`)
  ).rows;
  type UserRow = {
    id: string;
    email: string;
    created_at: string;
    status: string | null;
    sends: number | string;
    active_days: number;
    last_send_day: string | null;
  };
  type DayRow = { day: string; sends: number | string; active_users: number };
  const users = (result.users as UserRow[]).map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: new Date(r.created_at).toISOString(),
    status: r.status,
    sends: Number(r.sends),
    activeDays: Number(r.active_days),
    lastSendDay: r.last_send_day,
  }));
  const daily = (result.daily as DayRow[]).map((r) => ({
    day: r.day,
    sends: Number(r.sends),
    activeUsers: Number(r.active_users),
  }));
  return {
    filters,
    timezone: "UTC",
    activeDefinition:
      "Usuário com pelo menos um envio bem-sucedido pelo Malote no dia (UTC).",
    summary: {
      users: users.length,
      activeUsers: users.filter((u) => u.sends > 0).length,
      sends: users.reduce((sum, u) => sum + u.sends, 0),
      averageDau:
        daily.reduce((sum, d) => sum + d.activeUsers, 0) / daily.length,
    },
    daily,
    users,
  };
}

/** Daily breakdown for the same filtered accounts, including only days with sends. */
export async function adminUserDaily(
  db: Db,
  filters: AdminFilters,
  existingReport?: Awaited<ReturnType<typeof adminAnalytics>>,
) {
  const report = existingReport ?? (await adminAnalytics(db, filters));
  if (!report.users.length) return [];
  const ids = report.users.map((u) => u.id);
  const rows = (
    await db.execute(sql`select c.day, u.id::text as user_id, u.email, c.count as sends
    from send_counts c join wa_sessions s on s.id = c.session_id
    join neon_auth."user" u on u.id::text = s.user_id
    where c.day >= ${filters.from} and c.day <= ${filters.to} and c.count > 0
      and u.id::text = any(${sql.param(ids)}::text[]) order by c.day desc, c.count desc, u.email`)
  ).rows;
  return rows.map((r) => ({
    day: String(r.day),
    userId: String(r.user_id),
    email: String(r.email),
    sends: Number(r.sends),
  }));
}
