/**
 * HTTPS terminates inside the enclave: the certificate's private key is generated here and is only
 * stored encrypted with a key that Secret Manager releases to the attested image. Nothing in front of
 * the enclave (load balancer, proxy) can see MCP traffic or tokens.
 */
import { tlsCerts, type Db } from "@malote/db";
import acme from "acme-client";
import { eq } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes } from "node:crypto";
import type { Logger } from "pino";

export type Certificate = { key: string; cert: string; notAfter: Date };

/** Pending http-01 challenges (token → key authorization), served on port 80. */
export const acmeChallenges = new Map<string, string>();

const RENEW_BEFORE_MS = 30 * 24 * 3600_000;

function seal(key: Buffer, plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}

function open(key: Buffer, buf: Buffer) {
  const d = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

export function needsRenewal(c: Certificate) {
  return c.notAfter.getTime() - Date.now() < RENEW_BEFORE_MS;
}

/** SHA-256 of the certificate's public key (SPKI), hex. Put in attestations so clients can pin it. */
export function publicKeyFingerprint(certPem: string) {
  const spki = createPublicKey(certPem).export({ type: "spki", format: "der" });
  return createHash("sha256").update(spki).digest("hex");
}

/** Returns a stored certificate that is not close to expiring, or issues a new one via ACME http-01. */
export async function obtainCertificate(
  db: Db,
  opts: { hostname: string; email: string; directory: "production" | "staging"; wrapKey: string },
  log: Logger,
): Promise<Certificate> {
  const key = Buffer.from(opts.wrapKey, "base64");
  if (key.length !== 32) throw new Error("tls-wrap-key must be 32 bytes, base64-encoded");

  const [row] = await db.select().from(tlsCerts).where(eq(tlsCerts.hostname, opts.hostname)).limit(1);
  if (row) {
    try {
      const stored = { ...(JSON.parse(open(key, row.data)) as { key: string; cert: string }), notAfter: row.notAfter };
      if (!needsRenewal(stored)) return stored;
    } catch {
      log.warn("stored certificate could not be decrypted; issuing a new one");
    }
  }

  log.info({ hostname: opts.hostname, directory: opts.directory }, "requesting certificate");
  const client = new acme.Client({
    directoryUrl: acme.directory.letsencrypt[opts.directory],
    accountKey: await acme.crypto.createPrivateKey(),
  });
  const [privateKey, csr] = await acme.crypto.createCsr({ commonName: opts.hostname });
  const cert = await client.auto({
    csr,
    email: opts.email,
    termsOfServiceAgreed: true,
    challengePriority: ["http-01"],
    challengeCreateFn: async (_authz, challenge, keyAuthorization) => {
      acmeChallenges.set(challenge.token, keyAuthorization);
    },
    challengeRemoveFn: async (_authz, challenge) => {
      acmeChallenges.delete(challenge.token);
    },
  });
  const issued: Certificate = {
    key: privateKey.toString(),
    cert,
    notAfter: acme.crypto.readCertificateInfo(cert).notAfter,
  };
  const data = seal(key, JSON.stringify({ key: issued.key, cert: issued.cert }));
  await db
    .insert(tlsCerts)
    .values({ hostname: opts.hostname, data, notAfter: issued.notAfter })
    .onConflictDoUpdate({ target: tlsCerts.hostname, set: { data, notAfter: issued.notAfter, updatedAt: new Date() } });
  log.info({ notAfter: issued.notAfter }, "certificate issued");
  return issued;
}
