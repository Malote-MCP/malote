import { ENC_PREFIX, type Sealer } from "@malote/db";
import type pg from "pg";

const BATCH = 1000;
const plain = (col: string) => `(${col} is not null and ${col} not like '${ENC_PREFIX}%')`;

/**
 * Encrypts content stored before the user had a key (plaintext rows), in place.
 * Uses keyset pagination over the primary key so each row is visited once.
 */
export async function encryptLegacy(pool: pg.Pool, sessionId: string, s: Sealer) {
  let total = 0;

  let after = ["", ""];
  for (;;) {
    const { rows } = await pool.query<{ chat_jid: string; id: string; text: string | null; sender_name: string | null; media: string | null; raw: string | null }>(
      `select chat_jid, id, text, sender_name, media, raw from messages
       where session_id = $1 and (chat_jid, id) > ($2, $3)
         and (${plain("text")} or ${plain("sender_name")} or ${plain("media")} or ${plain("raw")})
       order by chat_jid, id limit ${BATCH}`,
      [sessionId, after[0], after[1]],
    );
    if (!rows.length) break;
    const keep = (v: string | null) => (v == null || v.startsWith(ENC_PREFIX) ? v : s.seal(v));
    await pool.query(
      `update messages m set text = v.text, sender_name = v.sender_name, media = v.media, raw = v.raw
       from unnest($2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]) as v(chat_jid, id, text, sender_name, media, raw)
       where m.session_id = $1 and m.chat_jid = v.chat_jid and m.id = v.id`,
      [
        sessionId,
        rows.map((r) => r.chat_jid),
        rows.map((r) => r.id),
        rows.map((r) => keep(r.text)),
        rows.map((r) => keep(r.sender_name)),
        rows.map((r) => keep(r.media)),
        rows.map((r) => keep(r.raw)),
      ],
    );
    total += rows.length;
    const last = rows[rows.length - 1];
    after = [last.chat_jid, last.id];
  }

  for (const [table, cols] of [
    ["chats", ["name"]],
    ["contacts", ["name", "notify"]],
  ] as const) {
    const { rows } = await pool.query<Record<string, string | null> & { jid: string }>(
      `select jid, ${cols.join(", ")} from ${table} where session_id = $1 and (${cols.map(plain).join(" or ")})`,
      [sessionId],
    );
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await pool.query(
        `update ${table} t set ${cols.map((c) => `${c} = v.${c}`).join(", ")}
         from unnest($2::text[], ${cols.map((_, j) => `$${j + 3}::text[]`).join(", ")}) as v(jid, ${cols.join(", ")})
         where t.session_id = $1 and t.jid = v.jid`,
        [
          sessionId,
          chunk.map((r) => r.jid),
          ...cols.map((c) => chunk.map((r) => (r[c] == null || r[c]!.startsWith(ENC_PREFIX) ? r[c] : s.seal(r[c])))),
        ],
      );
    }
    total += rows.length;
  }
  return total;
}
