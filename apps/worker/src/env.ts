import { readFileSync } from "node:fs";
import os from "node:os";
import { loadSecrets } from "./secrets.ts";
import { inEnclave } from "./tee.ts";

/** Public, non-secret settings of one deployment, committed in config/<env>.json. */
export type EnclaveConfig = {
  /** Hostname the enclave serves HTTPS on (its own Let's Encrypt certificate). */
  hostname: string;
  /** The web app's origin, allowed to call the token endpoints from the browser. */
  webOrigin: string;
  /** Neon Auth JWKS, to verify the signed-in user on the token endpoints. */
  neonAuthJwksUrl: string;
  secretsProject: string;
  /** Workload identity provider that maps an attestation token to IAM permissions. */
  wifAudience: string;
  secretPrefix: string;
  acmeEmail: string;
  acmeDirectory: "production" | "staging";
};

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

/**
 * Inside the enclave the only input the operator controls is MALOTE_ENV (the image's launch policy
 * allows overriding nothing else), and it can only pick one of the configs committed in the repo.
 */
function loadConfig(): EnclaveConfig | null {
  const name = process.env.MALOTE_ENV;
  if (!name) return null;
  if (!/^[a-z]+$/.test(name)) throw new Error(`invalid MALOTE_ENV: ${name}`);
  return JSON.parse(readFileSync(new URL(`../config/${name}.json`, import.meta.url), "utf8")) as EnclaveConfig;
}

const enclave = loadConfig();
const tee = inEnclave();
if (tee && !enclave) throw new Error("MALOTE_ENV must be set inside the enclave");

const secrets =
  tee && enclave
    ? await loadSecrets({ project: enclave.secretsProject, wifAudience: enclave.wifAudience, prefix: enclave.secretPrefix }, [
        "database-url",
        "database-url-unpooled",
        "wa-auth-key",
        "tls-wrap-key",
      ] as const)
    : null;

export const env = {
  databaseUrl: secrets?.["database-url"] ?? required("DATABASE_URL"),
  // LISTEN/NOTIFY needs a direct (non-pooled) connection.
  databaseUrlUnpooled: secrets?.["database-url-unpooled"] ?? process.env.DATABASE_URL_UNPOOLED ?? required("DATABASE_URL"),
  encryptionKey: secrets?.["wa-auth-key"] ?? required("MALOTE_ENCRYPTION_KEY"),
  /** Encrypts the stored TLS private key; only needed when serving HTTPS. */
  tlsWrapKey: secrets?.["tls-wrap-key"] ?? process.env.MALOTE_TLS_WRAP_KEY ?? null,
  workerId: process.env.FLY_MACHINE_ID ?? os.hostname(),
  logLevel: process.env.LOG_LEVEL ?? "info",
  inEnclave: tee,
  enclave,
  /** Local development: serve the enclave API over plain HTTP on this port (never inside the enclave). */
  devHttpPort: !tee && process.env.ENCLAVE_HTTP_PORT ? Number(process.env.ENCLAVE_HTTP_PORT) : null,
};
