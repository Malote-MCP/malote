/**
 * The enclave's public API. Everything that sees plaintext or a token is served from here, inside the
 * confidential VM, over HTTPS that terminates in this process:
 *   /mcp               MCP (Streamable HTTP), bearer = Malote token
 *   /media/:id         downloaded media, bearer = Malote token
 *   /v1/tokens         create / list / revoke tokens, bearer = Neon Auth JWT of the signed-in user
 *   /v1/attestation    Google-signed proof of the running image, bound to a nonce and the TLS key
 */
import {
  createToken,
  getSessionByUserId,
  listTokens,
  loadOpener,
  mediaFiles,
  NeedsAuthorization,
  revokeToken,
  verifyToken,
  type Db,
} from "@malote/db";
import { registerTools, type Caller, type WhatsAppOps } from "@malote/mcp";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { and, eq } from "drizzle-orm";
import { createRemoteJWKSet, jwtVerify } from "jose";
import http from "node:http";
import https from "node:https";
import { Readable } from "node:stream";
import type { Logger } from "pino";
import type { EnclaveConfig } from "./env.ts";
import { attestationToken } from "./tee.ts";
import { acmeChallenges, needsRenewal, obtainCertificate, publicKeyFingerprint, type Certificate } from "./tls.ts";

const ATTESTATION_AUDIENCE = "https://malote.io/verify";
const MAX_BODY = 40 * 1024 * 1024; // send_file accepts 25 MB files, base64-encoded

type Deps = { db: Db; ops: WhatsAppOps; log: Logger; config: EnclaveConfig | null; origin: string; webOrigin: string | null; jwksUrl: string | null };

function readBody(req: http.IncomingMessage, limit = MAX_BODY): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error("Corpo da requisição grande demais."), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function toWebRequest(req: http.IncomingMessage, origin: string) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(new URL(req.url ?? "/", origin), { method: req.method, headers, body: hasBody ? new Uint8Array(await readBody(req)) : undefined });
}

async function sendWeb(res: http.ServerResponse, response: Response, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  response.headers.forEach((v, k) => (headers[k] = v));
  res.writeHead(response.status, headers);
  if (!response.body) return void res.end();
  Readable.fromWeb(response.body as never).pipe(res);
}

function json(res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

const bearerOf = (req: http.IncomingMessage) => req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;

export function createEnclaveApi(deps: Deps) {
  const { db, ops, log } = deps;
  let fingerprint: string | null = null;

  const jwks = deps.jwksUrl ? createRemoteJWKSet(new URL(deps.jwksUrl)) : null;
  /** The signed-in web user, from the Neon Auth JWT the dashboard sends. */
  async function webUser(req: http.IncomingMessage) {
    const jwt = bearerOf(req);
    if (!jwt || !jwks) return null;
    try {
      const { payload } = await jwtVerify(jwt, jwks);
      return typeof payload.sub === "string" ? payload.sub : null;
    } catch {
      return null;
    }
  }

  const mcp = createMcpHandler(
    (ctx) => {
      const server = new McpServer({ name: "malote", version: "0.2.0" });
      const caller = (ctx.authInfo?.extra as Caller | undefined) ?? null;
      registerTools(
        server,
        { db, ops, mediaUrl: (id) => `${deps.origin}/media/${id}`, panelUrl: `${deps.webOrigin ?? deps.origin}/app` },
        () => caller,
      );
      return server;
    },
    { maxRequestBodySize: MAX_BODY, onerror: (e) => log.warn({ err: e.message }, "mcp error") },
  );

  const cors = (req: http.IncomingMessage): Record<string, string> =>
    deps.webOrigin && req.headers.origin === deps.webOrigin
      ? {
          "access-control-allow-origin": deps.webOrigin,
          "access-control-allow-headers": "authorization, content-type",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          vary: "origin",
        }
      : {};

  async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url ?? "/", deps.origin);
    const path = url.pathname;

    if (path === "/healthz") return json(res, 200, { ok: true });

    if (path === "/mcp") {
      const token = bearerOf(req);
      const auth = token ? await verifyToken(db, token) : null;
      if (!auth) {
        return json(res, 401, { error: "Token inválido." }, { "www-authenticate": 'Bearer realm="malote"' });
      }
      const caller: Caller = { userId: auth.userId, privateKey: auth.privateKey };
      const response = await mcp.fetch(await toWebRequest(req, deps.origin), {
        authInfo: { token: token!, clientId: `token:${auth.id}`, scopes: ["whatsapp"], extra: caller },
      });
      return sendWeb(res, response);
    }

    const media = path.match(/^\/media\/([0-9a-f-]{36})$/);
    if (media && req.method === "GET") {
      const token = bearerOf(req);
      const auth = token ? await verifyToken(db, token) : null;
      if (!auth) return json(res, 401, { error: "Unauthorized" });
      const session = await getSessionByUserId(db, auth.userId);
      const [file] = session
        ? await db
            .select()
            .from(mediaFiles)
            .where(and(eq(mediaFiles.id, media[1]), eq(mediaFiles.sessionId, session.id)))
            .limit(1)
        : [];
      if (!session || !file) return json(res, 404, { error: "Not found" });
      const data = (await loadOpener(db, session, auth.privateKey)).openBytes(file.data, file.epochId);
      res.writeHead(200, {
        "content-type": file.mimetype,
        "content-length": String(data.length),
        "content-disposition": `inline; filename="malote-${file.id}"`,
        "cache-control": "private, no-store",
      });
      return void res.end(data);
    }

    if (path === "/v1/tokens" || path.startsWith("/v1/tokens/")) {
      const headers = cors(req);
      if (req.method === "OPTIONS") return void res.writeHead(204, headers).end();
      const userId = await webUser(req);
      if (!userId) return json(res, 401, { error: "Unauthorized" }, headers);
      if (req.method === "GET" && path === "/v1/tokens") return json(res, 200, await listTokens(db, userId), headers);
      if (req.method === "POST" && path === "/v1/tokens") {
        const body = JSON.parse((await readBody(req, 64 * 1024)).toString() || "{}") as { name?: string; authorizeWith?: string; reset?: boolean };
        try {
          const created = await createToken(db, userId, (body.name ?? "").trim().slice(0, 60) || "Claude", {
            authorizeWith: body.authorizeWith,
            reset: body.reset === true,
          });
          return json(res, 200, created, headers);
        } catch (e) {
          if (e instanceof NeedsAuthorization) {
            return json(res, 409, { error: "Informe um token válido desta conta para destravar sua chave." }, headers);
          }
          throw e;
        }
      }
      const id = path.match(/^\/v1\/tokens\/([0-9a-f-]{36})$/)?.[1];
      if (req.method === "DELETE" && id) {
        await revokeToken(db, userId, id);
        return json(res, 200, { ok: true }, headers);
      }
      return json(res, 405, { error: "Method not allowed" }, headers);
    }

    if (path === "/v1/attestation") {
      // Public proof: any page or auditor may request it from a browser.
      const open = { "access-control-allow-origin": "*" };
      if (req.method === "OPTIONS") return void res.writeHead(204, { ...open, "access-control-allow-methods": "GET" }).end();
      if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" }, open);
      const nonce = url.searchParams.get("nonce") ?? "";
      if (!/^[A-Za-z0-9_-]{16,64}$/.test(nonce)) return json(res, 400, { error: "nonce: 16–64 caracteres [A-Za-z0-9_-]" }, open);
      if (!deps.config || !fingerprint) return json(res, 501, { error: "Atestação só existe dentro do enclave." }, open);
      const token = await attestationToken(ATTESTATION_AUDIENCE, [nonce, fingerprint]);
      return json(res, 200, { token, tls_public_key_sha256: fingerprint, audience: ATTESTATION_AUDIENCE }, { ...open, "cache-control": "no-store" });
    }

    json(res, 404, { error: "Not found" });
  }

  const listener = (req: http.IncomingMessage, res: http.ServerResponse) =>
    void handle(req, res).catch((e: Error & { status?: number }) => {
      log.error({ err: e.message, path: req.url?.split("?")[0] }, "request failed");
      if (!res.headersSent) json(res, e.status ?? 500, { error: e.status ? e.message : "Erro interno." });
      else res.end();
    });

  return {
    listener,
    setFingerprint: (f: string) => (fingerprint = f),
  };
}

/** Plain HTTP for local development. */
export function serveDev(deps: Deps, port: number) {
  const api = createEnclaveApi(deps);
  http.createServer(api.listener).listen(port, () => deps.log.info({ port }, "enclave API (dev, plain HTTP)"));
}

/** Production: ACME on :80, the API on :443 with a certificate whose key never leaves the enclave. */
export async function serveTls(deps: Deps & { config: EnclaveConfig; tlsWrapKey: string }) {
  const { config, db, log } = deps;
  http
    .createServer((req, res) => {
      const token = req.url?.match(/^\/\.well-known\/acme-challenge\/([A-Za-z0-9_-]+)$/)?.[1];
      const answer = token && acmeChallenges.get(token);
      if (answer) return void res.writeHead(200, { "content-type": "text/plain" }).end(answer);
      res.writeHead(301, { location: `https://${config.hostname}${req.url ?? "/"}` }).end();
    })
    .listen(80);

  const certOpts = { hostname: config.hostname, email: config.acmeEmail, directory: config.acmeDirectory, wrapKey: deps.tlsWrapKey };
  let cert: Certificate = await obtainCertificate(db, certOpts, log);
  const api = createEnclaveApi(deps);
  api.setFingerprint(publicKeyFingerprint(cert.cert));
  const server = https.createServer({ key: cert.key, cert: cert.cert }, api.listener).listen(443, () =>
    log.info({ hostname: config.hostname }, "enclave API listening on 443"),
  );

  setInterval(
    () =>
      void (async () => {
        if (!needsRenewal(cert)) return;
        cert = await obtainCertificate(db, certOpts, log);
        server.setSecureContext({ key: cert.key, cert: cert.cert });
        api.setFingerprint(publicKeyFingerprint(cert.cert));
      })().catch((e) => log.error({ err: (e as Error).message }, "certificate renewal failed")),
    12 * 3600_000,
  );
}
