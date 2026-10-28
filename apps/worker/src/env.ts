import os from "node:os";

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  // LISTEN/NOTIFY needs a direct (non-pooled) connection.
  databaseUrlUnpooled: process.env.DATABASE_URL_UNPOOLED ?? required("DATABASE_URL"),
  encryptionKey: required("MALOTE_ENCRYPTION_KEY"),
  workerId: process.env.FLY_MACHINE_ID ?? os.hostname(),
  logLevel: process.env.LOG_LEVEL ?? "info",
};
