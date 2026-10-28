import { waAuth, type Db } from "@malote/db";
import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type SignalDataTypeMap } from "baileys";
import { and, eq, inArray, sql } from "drizzle-orm";
import { decrypt, encrypt } from "./crypto.ts";

/** Baileys auth state persisted (encrypted) in Postgres instead of files. */
export async function usePostgresAuthState(db: Db, sessionId: string) {
  const read = async (key: string) => {
    const [row] = await db
      .select({ value: waAuth.value })
      .from(waAuth)
      .where(and(eq(waAuth.sessionId, sessionId), eq(waAuth.key, key)))
      .limit(1);
    return row ? JSON.parse(decrypt(row.value), BufferJSON.reviver) : null;
  };

  const write = async (entries: { key: string; value: unknown }[]) => {
    if (!entries.length) return;
    await db
      .insert(waAuth)
      .values(entries.map((e) => ({ sessionId, key: e.key, value: encrypt(JSON.stringify(e.value, BufferJSON.replacer)) })))
      .onConflictDoUpdate({ target: [waAuth.sessionId, waAuth.key], set: { value: sql.raw("excluded.value") } });
  };

  const remove = async (keys: string[]) => {
    if (!keys.length) return;
    await db.delete(waAuth).where(and(eq(waAuth.sessionId, sessionId), inArray(waAuth.key, keys)));
  };

  const creds: AuthenticationCreds = (await read("creds")) ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          if (!ids.length) return data;
          const rows = await db
            .select()
            .from(waAuth)
            .where(and(eq(waAuth.sessionId, sessionId), inArray(waAuth.key, ids.map((id) => `${type}-${id}`))));
          const byKey = new Map(rows.map((r) => [r.key, r.value]));
          for (const id of ids) {
            const raw = byKey.get(`${type}-${id}`);
            if (!raw) continue;
            let value = JSON.parse(decrypt(raw), BufferJSON.reviver);
            if (type === "app-state-sync-key") value = proto.Message.AppStateSyncKeyData.fromObject(value);
            data[id] = value;
          }
          return data;
        },
        set: async (data: { [T in keyof SignalDataTypeMap]?: { [id: string]: SignalDataTypeMap[T] | null } }) => {
          const upserts: { key: string; value: unknown }[] = [];
          const deletes: string[] = [];
          for (const category of Object.keys(data) as (keyof SignalDataTypeMap)[]) {
            for (const [id, value] of Object.entries(data[category] ?? {})) {
              const key = `${category}-${id}`;
              if (value) upserts.push({ key, value });
              else deletes.push(key);
            }
          }
          await Promise.all([write(upserts), remove(deletes)]);
        },
      },
    },
    saveCreds: () => write([{ key: "creds", value: creds }]),
    clear: () => db.delete(waAuth).where(eq(waAuth.sessionId, sessionId)),
  };
}
