/**
 * Encryption at rest of stored WhatsApp content.
 *
 * Each user has an X25519 key pair. The public key lives in `wa_sessions.public_key`; the private key
 * is only stored wrapped (AES-256-GCM) with a key derived from each of the user's MCP tokens, and the
 * server keeps only SHA-256 hashes of those tokens. So a copy of the database alone cannot be read.
 * This is not end-to-end: the running servers see new messages before sealing them and receive the
 * token on every MCP request (see /seguranca).
 *
 * The worker writes without the user present: per "epoch" it generates an ephemeral X25519 key, does
 * ECDH with the user's public key and keeps the derived AES key in memory only. The ephemeral public
 * key goes to `enc_epochs`; the user's private key (unwrapped from a token during an MCP request)
 * recomputes the same AES key to read.
 */
import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/** Prefix of every encrypted string value: `e1:<epochId>:<base64(iv | tag | ciphertext)>`. */
export const ENC_PREFIX = "e1:";

const b64u = (b: Buffer) => b.toString("base64url");
const unb64u = (s: string) => Buffer.from(s, "base64url");

function publicKeyObject(x: string) {
  return createPublicKey({ key: { kty: "OKP", crv: "X25519", x }, format: "jwk" });
}

function privateKeyObject(d: string, x: string) {
  return createPrivateKey({ key: { kty: "OKP", crv: "X25519", x, d }, format: "jwk" });
}

function aesSeal(key: Buffer, plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]);
}

function aesOpen(key: Buffer, buf: Buffer) {
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
}

function epochKey(shared: Buffer, epk: string, publicKey: string) {
  const salt = Buffer.concat([unb64u(epk), unb64u(publicKey)]);
  return Buffer.from(hkdfSync("sha256", shared, salt, "malote/epoch/v1", 32));
}

/** A new user key pair (base64url raw X25519 keys). */
export function generateUserKeyPair() {
  const { privateKey } = generateKeyPairSync("x25519");
  const jwk = privateKey.export({ format: "jwk" });
  return { publicKey: jwk.x!, privateKey: jwk.d! };
}

/** Starts an epoch for a user's public key: returns the ephemeral public key to store and the AES key to keep in memory. */
export function newEpoch(publicKey: string) {
  const eph = generateKeyPairSync("x25519");
  const epk = eph.publicKey.export({ format: "jwk" }).x!;
  const shared = diffieHellman({ privateKey: eph.privateKey, publicKey: publicKeyObject(publicKey) });
  return { epk, key: epochKey(shared, epk, publicKey) };
}

/** Write side (worker): encrypts with one epoch key. Never able to decrypt older epochs. */
export class Sealer {
  readonly createdAt = Date.now();
  constructor(
    readonly epochId: number,
    private key: Buffer,
  ) {}

  seal(value: string): string;
  seal(value: string | null | undefined): string | null;
  seal(value: string | null | undefined) {
    if (value == null) return null;
    return `${ENC_PREFIX}${this.epochId}:${aesSeal(this.key, Buffer.from(value, "utf8")).toString("base64")}`;
  }

  sealJson(value: unknown) {
    return value == null ? null : this.seal(JSON.stringify(value));
  }

  sealBytes(data: Buffer) {
    return aesSeal(this.key, data);
  }
}

export function isSealed(value: string | null | undefined) {
  return !!value && value.startsWith(ENC_PREFIX);
}

/** Read side (web, during an authenticated MCP request): decrypts with the user's private key. */
export class Opener {
  private keys = new Map<number, Buffer>();
  private privateKey: ReturnType<typeof createPrivateKey> | null;

  /** `privateKey` is null for accounts that have no key yet (legacy plaintext only). */
  constructor(
    privateKey: string | null,
    private publicKey: string | null,
    private epochs: Map<number, string>,
  ) {
    this.privateKey = privateKey && publicKey ? privateKeyObject(privateKey, publicKey) : null;
  }

  private keyFor(epochId: number) {
    let key = this.keys.get(epochId);
    if (key) return key;
    const epk = this.epochs.get(epochId);
    if (!epk || !this.privateKey || !this.publicKey) throw new Error("Chave de criptografia indisponível para este dado.");
    const shared = diffieHellman({ privateKey: this.privateKey, publicKey: publicKeyObject(epk) });
    key = epochKey(shared, epk, this.publicKey);
    this.keys.set(epochId, key);
    return key;
  }

  /** Decrypts a sealed string; plaintext (not yet migrated) values pass through unchanged. */
  open(value: string): string;
  open(value: string | null | undefined): string | null;
  open(value: string | null | undefined) {
    if (value == null) return null;
    if (!isSealed(value)) return value;
    const sep = value.indexOf(":", ENC_PREFIX.length);
    const epochId = Number(value.slice(ENC_PREFIX.length, sep));
    try {
      return aesOpen(this.keyFor(epochId), Buffer.from(value.slice(sep + 1), "base64")).toString("utf8");
    } catch {
      return null;
    }
  }

  openJson<T>(value: string | null | undefined): T | null {
    const s = this.open(value);
    return s == null ? null : (JSON.parse(s) as T);
  }

  openBytes(data: Buffer, epochId: number | null) {
    return epochId == null ? data : aesOpen(this.keyFor(epochId), data);
  }
}

// --- Token wrapping of the private key ---------------------------------------------------------

function wrapKeyFor(token: string, salt: Buffer) {
  return Buffer.from(hkdfSync("sha256", Buffer.from(token, "utf8"), salt, "malote/token-wrap/v1", 32));
}

/** Encrypts the user's private key with a key derived from an MCP token: `base64url(salt).base64url(iv|tag|ct)`. */
export function wrapPrivateKey(privateKey: string, token: string) {
  const salt = randomBytes(16);
  return `${b64u(salt)}.${b64u(aesSeal(wrapKeyFor(token, salt), unb64u(privateKey)))}`;
}

export function unwrapPrivateKey(wrapped: string, token: string) {
  const [salt, box] = wrapped.split(".");
  return b64u(aesOpen(wrapKeyFor(token, unb64u(salt)), unb64u(box)));
}
