import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import {
  adminAnalytics,
  adminUserDaily,
  parseAdminFilters,
} from "../src/admin-analytics.ts";
import { deleteAccount } from "../src/account.ts";
import { createDb, createPool } from "../src/index.ts";

const now = new Date("2026-11-03T01:00:00Z");
test("filters use inclusive UTC defaults and reject invalid ranges and calendar dates", () => {
  assert.deepEqual(parseAdminFilters({}, now), {
    from: "2026-10-05",
    to: "2026-11-03",
    query: "",
    status: "",
    activity: "",
  });
  for (const input of [
    { from: "2026-02-30" },
    { from: "2026-12-01", to: "2026-01-01" },
    { from: "2020-01-01" },
    { status: "invalid" },
    { activity: "invalid" },
  ]) {
    assert.throws(() => parseAdminFilters(input, now));
  }
});

const url = process.env.DATABASE_URL_TEST;
const skip = !url && "DATABASE_URL_TEST not set";
const pool = url ? createPool(url, 2) : null!;
const db = url ? createDb(pool) : null!;
const ids = [randomUUID(), randomUUID(), randomUUID()];
const prefix = `admin-test-${randomUUID()}`;
const filters = parseAdminFilters({
  from: "2026-11-01",
  to: "2026-11-03",
  query: prefix,
});

before(async () => {
  if (!url) return;
  await migrate(drizzle(pool), {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
  });
  // Disposable DBs used by CI have no Neon Auth service; these are the columns the admin reads.
  await pool.query("create schema if not exists neon_auth");
  await pool.query(
    'create table if not exists neon_auth."user" (id text primary key, email text not null, "createdAt" timestamptz not null default now())',
  );
  for (let i = 0; i < ids.length; i++)
    await pool.query(
      'insert into neon_auth."user" (id, email) values ($1, $2)',
      [ids[i], `${prefix}-${i}@example.com`],
    );
  for (const [i, status] of [
    [0, "connected"],
    [1, "logged_out"],
  ] as const) {
    const { rows } = await pool.query(
      "insert into wa_sessions (user_id, status, enabled) values ($1, $2, false) returning id",
      [ids[i], status],
    );
    await pool.query(
      "insert into send_counts (session_id, day, count) values ($1, '2026-11-01', $2), ($1, '2026-11-02', $3), ($1, '2026-10-31', 100)",
      [rows[0].id, i === 0 ? 3 : 2, i === 0 ? 4 : 0],
    );
  }
});
after(async () => {
  if (!url) return;
  await pool.query("delete from wa_sessions where user_id = any($1::text[])", [
    ids,
  ]);
  await pool.query('delete from neon_auth."user" where id = any($1::text[])', [
    ids,
  ]);
  await pool.end();
});

test(
  "counts distinct senders, zero days and inactive accounts without counting old sends",
  { skip },
  async () => {
    const report = await adminAnalytics(db, filters);
    assert.deepEqual(report.summary, {
      users: 3,
      activeUsers: 2,
      sends: 9,
      averageDau: 1,
    });
    assert.deepEqual(report.daily, [
      { day: "2026-11-01", sends: 5, activeUsers: 2 },
      { day: "2026-11-02", sends: 4, activeUsers: 1 },
      { day: "2026-11-03", sends: 0, activeUsers: 0 },
    ]);
    assert.equal(report.users[0].activeDays, 2);
    assert.equal((await adminUserDaily(db, filters)).length, 3);
  },
);

test(
  "filters narrow the same cohort in daily totals, users and per-user days",
  { skip },
  async () => {
    const connected = { ...filters, status: "connected" };
    assert.equal((await adminAnalytics(db, connected)).summary.sends, 7);
    assert.equal((await adminUserDaily(db, connected)).length, 2);
    assert.equal(
      (await adminAnalytics(db, { ...filters, activity: "inactive" })).summary
        .users,
      1,
    );
    assert.equal(
      (await adminAnalytics(db, { ...filters, status: "none" })).users[0].id,
      ids[2],
    );
    assert.equal(
      (await adminAnalytics(db, { ...filters, query: ids[0] })).summary.sends,
      7,
    );
    const empty = await adminAnalytics(db, {
      ...filters,
      query: "' OR true --",
    });
    assert.equal(empty.users.length, 0);
    assert.ok(empty.daily.every((d) => d.sends === 0 && d.activeUsers === 0));
  },
);

test(
  "account deletion removes limits, tokens, terms, session, counts and auth account",
  { skip },
  async () => {
    // The disconnected fixture avoids needing a live WhatsApp worker.
    await pool.query(
      "insert into send_limits (user_id, per_day) values ($1, 50)",
      [ids[1]],
    );
    await pool.query(
      "insert into api_tokens (user_id, name, token_hash, prefix) values ($1, 'test', $2, 'test')",
      [ids[1], randomUUID()],
    );
    await pool.query(
      "insert into terms_acceptances (user_id, terms_version, privacy_version) values ($1, 'test', 'test')",
      [ids[1]],
    );
    await deleteAccount(db, ids[1]);
    for (const table of [
      "send_limits",
      "api_tokens",
      "terms_acceptances",
      "wa_sessions",
    ]) {
      assert.equal(
        (
          await pool.query(
            `select count(*)::int as n from ${table} where user_id = $1`,
            [ids[1]],
          )
        ).rows[0].n,
        0,
      );
    }
    assert.equal((await adminAnalytics(db, filters)).summary.sends, 7);
  },
);
