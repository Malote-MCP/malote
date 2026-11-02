"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Logo } from "./logo";

const inline = "font-medium text-moss underline underline-offset-2";

/** Shown instead of the panel until the user accepts the current Terms and Privacy Policy. */
export function TermsGate({ termsVersion, privacyVersion }: { termsVersion: string; privacyVersion: string }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account/terms", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setError("Não foi possível registrar o aceite. Tente de novo.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-md rounded-3xl border border-line bg-white/70 p-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Antes de continuar</h1>
        <p className="mt-2 text-sm text-ink-2">
          Para usar o Malote, leia e aceite os <Link className={inline} href="/termos" target="_blank">Termos de Uso</Link>{" "}
          (versão de {termsVersion.split("-").reverse().join("/")}) e a{" "}
          <Link className={inline} href="/privacidade" target="_blank">Política de Privacidade</Link> (versão de{" "}
          {privacyVersion.split("-").reverse().join("/")}).
        </p>
        <label className="mt-5 flex items-start gap-3 text-sm text-ink-2">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>Li e aceito os Termos de Uso e declaro ter conhecimento da Política de Privacidade. Tenho 18 anos ou mais.</span>
        </label>
        {error && <p className="mt-4 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
        <button
          onClick={accept}
          disabled={!checked || busy}
          className="mt-6 w-full rounded-full bg-moss px-4 py-2.5 font-medium text-paper hover:bg-moss-2 disabled:opacity-60"
        >
          {busy ? "Aguarde…" : "Aceitar e continuar"}
        </button>
        <button
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
          }}
          className="mt-3 w-full rounded-full px-4 py-2 text-sm text-ink-3 hover:bg-paper-2"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

/** Account deletion (Política 12.3, Termos 16.2). */
export function DeleteAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/account", { method: "DELETE", body: JSON.stringify({ confirm }) }).catch(() => null);
    if (!res?.ok) {
      setBusy(false);
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Não foi possível excluir a conta. Tente de novo.");
      return;
    }
    await authClient.signOut().catch(() => {});
    router.push("/?conta=excluida");
  }

  return (
    <section className="rounded-3xl border border-line bg-white/70 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-semibold tracking-tight">Excluir conta</h2>
      <p className="mt-1 text-sm text-ink-3">
        Desconecta o WhatsApp e apaga de forma definitiva o histórico, os contatos, as mídias, as chaves, os tokens e o cadastro.
        Não dá para desfazer. Conteúdo já enviado aos seus Clientes MCP não é alcançado.
      </p>
      {!open ? (
        <button onClick={() => setOpen(true)} className="mt-5 rounded-full border border-clay/40 px-4 py-2 text-sm font-medium text-clay hover:bg-clay/10">
          Excluir minha conta…
        </button>
      ) : (
        <div className="mt-5 space-y-3">
          <label className="block text-sm text-ink-2">
            Digite <strong>EXCLUIR</strong> para confirmar
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="field" autoComplete="off" />
          </label>
          {error && <p className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={remove}
              disabled={confirm !== "EXCLUIR" || busy}
              className="rounded-full bg-clay px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
            >
              {busy ? "Excluindo…" : "Excluir definitivamente"}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} className="rounded-full border border-line px-4 py-2 text-sm hover:bg-paper-2">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
