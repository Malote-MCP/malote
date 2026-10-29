/**
 * Checks, from outside, what an enclave is running. Anyone can run it:
 *   node --import tsx scripts/verify-attestation.ts mcp-staging.malote.io [sha256:<expected digest>]
 * It sends a fresh nonce, verifies Google's signature on the returned attestation token, and checks
 * that the token names the TLS key of the very connection we made (no proxy in between).
 */
import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash, randomBytes, X509Certificate } from "node:crypto";
import tls from "node:tls";

const [host, expected] = process.argv.slice(2);
if (!host) throw new Error("usage: verify-attestation.ts <hostname> [sha256:<digest>]");

const nonce = randomBytes(16).toString("hex");
const res = await fetch(`https://${host}/v1/attestation?nonce=${nonce}`);
if (!res.ok) throw new Error(`attestation request failed: ${res.status} ${await res.text()}`);
const { token } = (await res.json()) as { token: string };

const jwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/metadata/jwk/signer@confidentialspace-sign.iam.gserviceaccount.com"),
);
const { payload } = await jwtVerify(token, jwks, {
  issuer: "https://confidentialcomputing.googleapis.com",
  audience: "https://malote.io/verify",
});
const p = payload as Record<string, any>;

const peer = await new Promise<tls.PeerCertificate>((ok, fail) => {
  const s = tls.connect(443, host, { servername: host }, () => {
    ok(s.getPeerCertificate());
    s.end();
  });
  s.on("error", fail);
});
const spki = new X509Certificate(peer.raw).publicKey.export({ type: "spki", format: "der" });
const fingerprint = createHash("sha256").update(spki).digest("hex");

const digest = p.submods?.container?.image_digest as string;
const checks: [string, boolean, string][] = [
  ["Google signature", true, "valid"],
  ["Confidential Space", p.swname === "CONFIDENTIAL_SPACE", String(p.swname)],
  ["debug disabled", p.dbgstat === "disabled-since-boot", String(p.dbgstat)],
  ["stable image", (p.submods?.confidential_space?.support_attributes ?? []).includes("STABLE"), "support_attributes"],
  ["our nonce", (p.eat_nonce ?? []).includes(nonce), nonce],
  ["TLS key of this connection", (p.eat_nonce ?? []).includes(fingerprint), fingerprint.slice(0, 16) + "…"],
  ["image digest", !expected || digest === expected, digest],
];
for (const [name, ok, detail] of checks) console.log(`${ok ? "✓" : "✗"} ${name}: ${detail}`);
console.log(`  hardware: ${p.hwmodel}, env: ${p.submods?.container?.env?.MALOTE_ENV}, image: ${p.submods?.container?.image_reference}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
