import { createDb, createPool, type Db } from "@malote/db";

const globalForDb = globalThis as unknown as { maloteDb?: Db };

// Fly runs Next as a long-lived Node server, so one shared pool is reused across requests.
export const db: Db = (globalForDb.maloteDb ??= createDb(createPool(process.env.DATABASE_URL!, 10)));
