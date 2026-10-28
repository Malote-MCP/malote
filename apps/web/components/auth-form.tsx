"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Logo } from "./logo";

const oauthErrors: Record<string, string> = {
  state_mismatch: "O login com o Google expirou ou foi aberto duas vezes. Tente de novo numa única aba.",
  invalid_code: "O Google recusou o login. Tente de novo.",
  access_denied: "Você cancelou o login com o Google.",
};

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const isSignUp = mode === "sign-up";

  // Neon Auth sends OAuth failures back as ?error=<code>.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code) setError(oauthErrors[code] ?? `Não foi possível entrar com o Google (${code}). Tente de novo.`);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending("email");
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const { error } = isSignUp
      ? await authClient.signUp.email({ email, password, name: String(form.get("name") || email.split("@")[0]) })
      : await authClient.signIn.email({ email, password });
    setPending(null);
    if (error) {
      setError(error.message || "Não foi possível entrar. Tente de novo.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  async function google() {
    setError(null);
    setPending("google");
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/app`,
      errorCallbackURL: `${window.location.origin}/auth/sign-in`,
    });
    if (error) {
      setPending(null);
      setError(error.message || "Falha ao entrar com o Google.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm rounded-3xl border border-line bg-white/70 p-7 shadow-[0_20px_60px_-30px_rgba(29,27,22,0.35)]">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {isSignUp ? "Crie sua conta" : "Entrar no Malote"}
        </h1>
        <p className="mt-1 text-sm text-ink-3">
          {isSignUp ? "Depois é só escanear o QR code." : "Bem-vindo de volta."}
        </p>

        <button
          type="button"
          onClick={google}
          disabled={pending !== null}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-line bg-white px-4 py-2.5 font-medium hover:bg-paper disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
            <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6.1z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.8 6.1C6.6 42.6 14.6 48 24 48z" />
          </svg>
          {pending === "google" ? "Abrindo o Google…" : "Continuar com o Google"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs text-ink-3">
          <span className="h-px flex-1 bg-line" /> ou com e-mail <span className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {isSignUp && (
            <label className="block">
              <span className="text-sm font-medium text-ink-2">Nome</span>
              <input name="name" type="text" autoComplete="name" className="field" placeholder="Como te chamamos" />
            </label>
          )}
          <label className="block">
            <span className="text-sm font-medium text-ink-2">E-mail</span>
            <input name="email" type="email" required autoComplete="email" className="field" placeholder="voce@email.com" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-ink-2">Senha</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              className="field"
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          {error && <p className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{error}</p>}
          <button
            type="submit"
            disabled={pending !== null}
            className="w-full rounded-full bg-moss px-4 py-2.5 font-medium text-paper hover:bg-moss-2 disabled:opacity-60"
          >
            {pending === "email" ? "Aguarde…" : isSignUp ? "Criar conta" : "Entrar"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-sm text-ink-3">
        {isSignUp ? "Já tem conta? " : "Ainda não tem conta? "}
        <Link href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"} className="font-medium text-moss hover:underline">
          {isSignUp ? "Entrar" : "Criar conta"}
        </Link>
      </p>
    </div>
  );
}
