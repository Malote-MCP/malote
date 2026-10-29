import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export * from "./schema.ts";
export * from "./queries.ts";
export * from "./commands.ts";
export * from "./crypto.ts";
export * from "./tokens.ts";
export { schema };

export type Db = NodePgDatabase<typeof schema>;

export function createPool(connectionString: string, max = 10) {
  return new pg.Pool({ connectionString, max, idleTimeoutMillis: 30_000 });
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}

export const COMMANDS_CHANNEL = "malote_commands";
