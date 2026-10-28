/**
 * Send limits enforced by the worker for every source (MCP and web).
 * A personal assistant never needs more than this; bursts are what get numbers banned.
 */
const PER_MINUTE = Number(process.env.MALOTE_SENDS_PER_MINUTE ?? 10);
const PER_DAY = Number(process.env.MALOTE_SENDS_PER_DAY ?? 200);

const history = new Map<string, number[]>();

export class PolicyError extends Error {}

export async function checkSendAllowed(sessionId: string, opts: { knownChat: boolean }) {
  if (!opts.knownChat) {
    throw new PolicyError(
      "Envio bloqueado: o Malote só envia para conversas que já existem no seu WhatsApp (proteção contra banimento).",
    );
  }
  const now = Date.now();
  const sends = (history.get(sessionId) ?? []).filter((t) => now - t < 24 * 3600_000);
  history.set(sessionId, sends);
  if (sends.filter((t) => now - t < 60_000).length >= PER_MINUTE) {
    throw new PolicyError(`Limite de ${PER_MINUTE} envios por minuto atingido. Tente de novo em instantes.`);
  }
  if (sends.length >= PER_DAY) throw new PolicyError(`Limite diário de ${PER_DAY} envios atingido.`);
}

export function recordSend(sessionId: string) {
  const list = history.get(sessionId) ?? [];
  list.push(Date.now());
  history.set(sessionId, list);
}
