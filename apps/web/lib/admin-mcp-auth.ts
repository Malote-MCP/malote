import { createHash, timingSafeEqual } from "node:crypto";

/** Dedicated reporting credential. Never accepts ordinary WhatsApp tokens or browser cookies. */
export function verifyAdminMcpToken(
  bearer: string | undefined,
  configured = process.env.ADMIN_MCP_TOKEN,
) {
  if (!bearer || !configured || configured.length < 32) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(bearer), hash(configured));
}
