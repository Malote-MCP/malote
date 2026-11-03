/**
 * Read-only numbers for the operator's admin page. Deliberately limited to accounts, connection
 * state and counts: nothing here reads message text, contact names, phone numbers or chat ids.
 */
import { sql } from "drizzle-orm";
import type { Db } from "./index.ts";
import { GLOBAL_LIMITS } from "./limits.ts";

const n = (v: unknown) => Number(v ?? 0);

export type AdminOverview = {
  users: number;
  usersLast7d: number;
  usersLast30d: number;
  acceptedTerms: number;
  sessionsByStatus: Record<string, number>;
  sessionsEnabled: number;
  activeTokens: number;
  tokensUsed24h: number;
  tokensUsed7d: number;
  messagesStored: number;
  mediaBytes: number;
  sendsToday: number;
  sends7d: number;
  signupsByDay: { day: string; count: number }[];
  workers: { id: string; gitSha: string | null; imageRef: string | null; seenAt: string }[];
};

export async function adminOverview(db: Db): Promise<AdminOverview> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const [u] = (
    await db.execute(sql`select
      count(*) as users,
      count(*) filter (where "createdAt" > now() - interval '7 days') as d7,
      count(*) filter (where "createdAt" > now() - interval '30 days') as d30
      from neon_auth."user"`)
  ).rows;
  const [t] = (
    await db.execute(sql`select
      count(*) filter (where revoked_at is null) as active,
      count(*) filter (where revoked_at is null and last_used_at > now() - interval '1 day') as d1,
      count(*) filter (where revoked_at is null and last_used_at > now() - interval '7 days') as d7
      from api_tokens`)
  ).rows;
  const statuses = (await db.execute(sql`select status, count(*) as c, count(*) filter (where enabled) as e from wa_sessions group by status`)).rows;
  const [accepted] = (await db.execute(sql`select count(distinct user_id) as c from terms_acceptances`)).rows;
  // Planner estimate: an exact count(*) over every stored message is not worth the scan here.
  const [msgs] = (await db.execute(sql`select coalesce(sum(n_live_tup), 0) as c from pg_stat_user_tables where relname = 'messages'`)).rows;
  const [media] = (await db.execute(sql`select coalesce(sum(size), 0) as b from media_files`)).rows;
  const [sends] = (
    await db.execute(sql`select
      coalesce(sum(count) filter (where day = ${today}), 0) as today,
      coalesce(sum(count) filter (where day >= ${weekAgo}), 0) as d7
      from send_counts`)
  ).rows;
  const signups = (
    await db.execute(sql`select to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as day, count(*) as c
      from neon_auth."user" where "createdAt" > now() - interval '30 days' group by 1 order by 1`)
  ).rows;
  const workers = (
    await db.execute(sql`select id, git_sha, image_ref, seen_at from workers where seen_at > now() - interval '1 day' order by seen_at desc`)
  ).rows;

  return {
    users: n(u?.users),
    usersLast7d: n(u?.d7),
    usersLast30d: n(u?.d30),
    acceptedTerms: n(accepted?.c),
    sessionsByStatus: Object.fromEntries(statuses.map((r) => [String(r.status), n(r.c)])),
    sessionsEnabled: statuses.reduce((s, r) => s + n(r.e), 0),
    activeTokens: n(t?.active),
    tokensUsed24h: n(t?.d1),
    tokensUsed7d: n(t?.d7),
    messagesStored: n(msgs?.c),
    mediaBytes: n(media?.b),
    sendsToday: n(sends?.today),
    sends7d: n(sends?.d7),
    signupsByDay: signups.map((r) => ({ day: String(r.day), count: n(r.c) })),
    workers: workers.map((r) => ({
      id: String(r.id),
      gitSha: (r.git_sha as string | null) ?? null,
      imageRef: (r.image_ref as string | null) ?? null,
      seenAt: new Date(r.seen_at as string).toISOString(),
    })),
  };
}

export type AdminUser = {
  id: string;
  email: string;
  createdAt: string;
  acceptedTerms: boolean;
  waStatus: string | null;
  waEnabled: boolean;
  lastSeenAt: string | null;
  activeTokens: number;
  tokenLastUsedAt: string | null;
  sendsToday: number;
  sends7d: number;
  limitPerMinute: number | null;
  limitPerDay: number | null;
};

export async function adminUsers(db: Db): Promise<AdminUser[]> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 6 * 86400_000).toISOString().slice(0, 10);
  const rows = (
    await db.execute(sql`select
        u.id::text as id, u.email, u."createdAt" as created_at,
        exists (select 1 from terms_acceptances ta where ta.user_id = u.id::text) as accepted,
        s.status, coalesce(s.enabled, false) as enabled, s.last_seen_at,
        (select count(*) from api_tokens t where t.user_id = u.id::text and t.revoked_at is null) as tokens,
        (select max(last_used_at) from api_tokens t where t.user_id = u.id::text) as token_used,
        (select coalesce(sum(count), 0) from send_counts c where c.session_id = s.id and c.day = ${today}) as sends_today,
        (select coalesce(sum(count), 0) from send_counts c where c.session_id = s.id and c.day >= ${weekAgo}) as sends_7d,
        l.per_minute, l.per_day
      from neon_auth."user" u
      left join wa_sessions s on s.user_id = u.id::text
      left join send_limits l on l.user_id = u.id::text
      order by u."createdAt" desc`)
  ).rows;
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return rows.map((r) => ({
    id: String(r.id),
    email: String(r.email),
    createdAt: iso(r.created_at)!,
    acceptedTerms: Boolean(r.accepted),
    waStatus: (r.status as string | null) ?? null,
    waEnabled: Boolean(r.enabled),
    lastSeenAt: iso(r.last_seen_at),
    activeTokens: n(r.tokens),
    tokenLastUsedAt: iso(r.token_used),
    sendsToday: n(r.sends_today),
    sends7d: n(r.sends_7d),
    limitPerMinute: (r.per_minute as number | null) ?? null,
    limitPerDay: (r.per_day as number | null) ?? null,
  }));
}

export async function globalSendLimits(db: Db) {
  const [r] = (await db.execute(sql`select per_minute, per_day from send_limits where user_id = ${GLOBAL_LIMITS}`)).rows;
  return { perMinute: (r?.per_minute as number | null) ?? null, perDay: (r?.per_day as number | null) ?? null };
}
