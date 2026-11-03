/**
 * Send limits enforced by the worker for every source (MCP and web).
 * A personal assistant never needs more than this; bursts are what get numbers banned.
 *
 * The operator can tune the limits from the admin page (table send_limits), but the values are
 * clamped to SEND_LIMIT_CAPS, which are compiled into this image: they can be lowered from outside,
 * never raised past what the audited code allows.
 */
import { effectiveSendLimits, SEND_LIMIT_DEFAULTS, type SendLimits } from "@malote/db";

const DEFAULTS = {
  perMinute: Number(process.env.MALOTE_SENDS_PER_MINUTE ?? SEND_LIMIT_DEFAULTS.perMinute),
  perDay: Number(process.env.MALOTE_SENDS_PER_DAY ?? SEND_LIMIT_DEFAULTS.perDay),
};

const history = new Map<string, number[]>();

export class PolicyError extends Error {}

export async function checkSendAllowed(
  sessionId: string,
  opts: { knownChat: boolean; limits?: SendLimits },
) {
  if (!opts.knownChat) {
    throw new PolicyError(
      "Envio bloqueado: o Malote só envia para conversas que já existem no seu WhatsApp (proteção contra banimento).",
    );
  }
  const { perMinute, perDay } = effectiveSendLimits(opts.limits ?? { perMinute: null, perDay: null }, DEFAULTS);
  const now = Date.now();
  const sends = (history.get(sessionId) ?? []).filter((t) => now - t < 24 * 3600_000);
  history.set(sessionId, sends);
  if (sends.filter((t) => now - t < 60_000).length >= perMinute) {
    throw new PolicyError(`Limite de ${perMinute} envios por minuto atingido. Tente de novo em instantes.`);
  }
  if (sends.length >= perDay) throw new PolicyError(`Limite diário de ${perDay} envios atingido.`);
}

export function recordSend(sessionId: string) {
  const list = history.get(sessionId) ?? [];
  list.push(Date.now());
  history.set(sessionId, list);
}
