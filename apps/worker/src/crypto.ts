import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env.ts";

const key = Buffer.from(env.encryptionKey, "base64");
if (key.length !== 32) throw new Error("MALOTE_ENCRYPTION_KEY must be 32 bytes, base64-encoded");

/** AES-256-GCM; output is base64(iv | tag | ciphertext). */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

export function decrypt(payload: string) {
  const buf = Buffer.from(payload, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12));
  decipher.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
}
