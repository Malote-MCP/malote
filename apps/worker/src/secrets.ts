/**
 * Secrets for the enclave. They never come from environment variables there: Confidential Space puts
 * the container's environment inside every attestation token. Instead the enclave proves what it is
 * (attestation token) to Google STS, and Secret Manager only releases secrets to the workload
 * identity whose attributes (image digest, debug off, …) the IAM policy allows.
 */
import { attestationToken } from "./tee.ts";

export type SecretSource = { project: string; wifAudience: string; prefix: string };

async function federatedAccessToken(wifAudience: string) {
  const subject = await attestationToken("https://sts.googleapis.com");
  const res = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: wifAudience,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      subject_token: subject,
      subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    }),
  });
  if (!res.ok) throw new Error(`STS token exchange failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Reads the latest version of each named secret (names get the environment prefix). */
export async function loadSecrets<K extends string>(src: SecretSource, names: readonly K[]): Promise<Record<K, string>> {
  const token = await federatedAccessToken(src.wifAudience);
  const out = {} as Record<K, string>;
  for (const name of names) {
    const url = `https://secretmanager.googleapis.com/v1/projects/${src.project}/secrets/${src.prefix}${name}/versions/latest:access`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`secret ${src.prefix}${name}: ${res.status} ${await res.text()}`);
    const { payload } = (await res.json()) as { payload: { data: string } };
    out[name] = Buffer.from(payload.data, "base64").toString("utf8").trim();
  }
  return out;
}
