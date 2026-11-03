"use client";

import { useState } from "react";

export type BillingView = {
  status: string;
  plan: string | null;
  freeForever: boolean;
  hasAccess: boolean;
  accessUntil: string | null;
  trialEndsAt: string;
  hasSubscription: boolean;
  referralLink: string;
  referrals: { total: number; rewarded: number };
  bonusDays: number;
  paymentsEnabled: boolean;
  notice: string | null;
};

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const daysLeft = (iso: string | null) => (iso ? Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000)) : 0);

const notices: Record<string, string> = {
  ok: "Pagamento enviado ao Asaas. No Pix, o acesso é liberado em instantes; no cartão, a assinatura começa e a primeira cobrança acontece quando o seu acesso atual terminar.",
  cancelado: "Pagamento cancelado. Nada foi cobrado.",
  expirado: "O link de pagamento expirou. Abra de novo quando quiser.",
};

export function BillingCard({ b }: { b: BillingView }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function subscribe(plan: "monthly" | "yearly", method: "card" | "pix") {
    setBusy(`${plan}-${method}`);
    setError(null);
    const res = await fetch("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan, method }) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!res?.ok || !body?.url) {
      setBusy(null);
      setError(body?.error ?? "Não foi possível abrir o pagamento.");
      return;
    }
    window.location.href = body.url;
  }

  async function cancel() {
    if (busy) return;
    setBusy("cancel");
    setError(null);
    const res = await fetch("/api/billing/checkout", { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setBusy(null);
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Não foi possível cancelar.");
      return;
    }
    window.location.reload();
  }

  let headline: string;
  let detail: string;
  if (b.freeForever) {
    headline = "Sua conta é gratuita";
    detail = "Cortesia do Malote, sem prazo para acabar.";
  } else if (b.status === "active" && b.hasSubscription) {
    headline = `Plano ${b.plan === "yearly" ? "anual" : "mensal"} ativo`;
    detail = `Acesso garantido até ${date(b.accessUntil)}. A renovação é automática no cartão.`;
  } else if (b.hasAccess && b.status === "trial") {
    headline = `Teste grátis: ${daysLeft(b.accessUntil)} ${daysLeft(b.accessUntil) === 1 ? "dia" : "dias"}`;
    detail = `Seu acesso vai até ${date(b.accessUntil)}. Assine antes para não parar; a primeira cobrança só acontece quando o teste terminar.`;
  } else if (b.hasAccess && b.status === "active") {
    headline = "Pago até " + date(b.accessUntil);
    detail = "Pagamento por Pix, sem renovação automática. Para continuar depois dessa data, pague o próximo período abaixo ou assine no cartão.";
  } else if (b.hasAccess) {
    headline = "Acesso até " + date(b.accessUntil);
    detail = b.status === "canceled" ? "Assinatura cancelada: você usa até o fim do período pago." : "Pagamento pendente: regularize para não perder o acesso.";
  } else {
    headline = "Seu acesso terminou";
    detail = "O Claude não consegue mais usar seu WhatsApp pelo Malote. Assine para voltar; o histórico continua guardado.";
  }

  const showPlans = !b.freeForever && !(b.status === "active" && b.hasSubscription);

  return (
    <section className={`rounded-3xl border bg-white/70 p-6 sm:p-8 ${b.hasAccess ? "border-line" : "border-clay/50"}`}>
      <h2 className="font-display text-2xl font-semibold tracking-tight">Plano</h2>
      {b.notice && notices[b.notice] && <p className="mt-3 rounded-xl bg-paper-2 px-3 py-2 text-sm text-ink-2">{notices[b.notice]}</p>}
      <p className={`mt-3 font-medium ${b.hasAccess ? "" : "text-clay"}`}>{headline}</p>
      <p className="mt-1 text-sm text-ink-3">{detail}</p>

      {showPlans && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {(
            [
              ["monthly", "Mensal", "R$ 29,90", "por mês", "1 mês"],
              ["yearly", "Anual", "R$ 299", "por ano · 2 meses grátis", "1 ano"],
            ] as const
          ).map(([id, name, price, per, period]) => (
            <div key={id} className="rounded-2xl border border-line bg-white p-4">
              <span className="text-sm text-ink-3">{name}</span>
              <span className="mt-1 block font-display text-2xl font-semibold">{price}</span>
              <span className="text-xs text-ink-3">{per}</span>
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={() => subscribe(id, "card")}
                  disabled={!b.paymentsEnabled || busy !== null}
                  className="rounded-full bg-ink px-4 py-2 text-left text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {busy === `${id}-card` ? "Abrindo o Asaas…" : "Assinar no cartão →"}
                </button>
                <button
                  onClick={() => subscribe(id, "pix")}
                  disabled={!b.paymentsEnabled || busy !== null}
                  className="rounded-full border border-line px-4 py-2 text-left text-sm font-medium text-moss hover:border-moss disabled:opacity-60"
                >
                  {busy === `${id}-pix` ? "Abrindo o Asaas…" : `Pagar ${period} no Pix →`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showPlans && b.paymentsEnabled && (
        <p className="mt-3 text-xs text-ink-3">No cartão, a assinatura renova sozinha e você pode cancelar quando quiser. No Pix, você paga um período por vez, sem renovação automática.</p>
      )}
      {showPlans && !b.paymentsEnabled && <p className="mt-3 text-xs text-ink-3">Os pagamentos abrem em breve.</p>}
      {b.hasSubscription && b.status === "active" && (
        <button onClick={cancel} disabled={busy !== null} className="mt-5 text-sm text-ink-3 underline underline-offset-2 hover:text-clay">
          {busy === "cancel" ? "Cancelando…" : "Cancelar renovação"}
        </button>
      )}
      {error && <p className="mt-4 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}

      {!b.freeForever && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-medium">Indique e ganhe 15 dias</p>
          <p className="mt-1 text-sm text-ink-3">
            Quando alguém cria a conta pelo seu link e conecta o WhatsApp, você ganha 15 dias a mais de acesso.
            {b.referrals.total > 0 && ` Indicações: ${b.referrals.total} · com bônus: ${b.referrals.rewarded}.`}
          </p>
          <div className="mt-3 flex gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-line bg-paper px-3 py-2 text-xs">{b.referralLink}</code>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(b.referralLink).catch(() => {});
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="rounded-full border border-line px-4 py-2 text-sm hover:bg-paper-2"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
