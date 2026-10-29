/**
 * Talks to the Confidential Space launcher, which only exists inside a confidential VM. The launcher
 * returns attestation tokens signed by Google that describe the hardware, the boot and the exact
 * container image digest running here.
 */
import { existsSync } from "node:fs";
import http from "node:http";

const SOCKET = "/run/container_launcher/teeserver.sock";

export const inEnclave = () => existsSync(SOCKET);

/**
 * Requests an OIDC attestation token. `nonces` (10–74 bytes each, up to 6) end up in the token's
 * `eat_nonce` claim, which binds the token to a challenge or to this server's TLS key.
 */
export function attestationToken(audience: string, nonces: string[] = []): Promise<string> {
  const body = JSON.stringify({ audience, token_type: "OIDC", ...(nonces.length ? { nonces } : {}) });
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: SOCKET, path: "/v1/token", method: "POST", headers: { "content-type": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          res.statusCode === 200 ? resolve(data.trim()) : reject(new Error(`attestation token: ${res.statusCode} ${data}`)),
        );
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}
