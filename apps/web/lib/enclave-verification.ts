"use client";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { signatureFailure } from "./verification-failure";
import { useEffect, useState } from "react";

const GOOGLE_JWKS = "https://www.googleapis.com/service_accounts/v1/metadata/jwk/signer@confidentialspace-sign.iam.gserviceaccount.com";
const googleKeys = createRemoteJWKSet(new URL(GOOGLE_JWKS), { timeoutDuration: 15000 });
export const allowedDigestsUrl = (env: string) =>
  `https://raw.githubusercontent.com/Malote-MCP/malote/main/infra/gcp/allowed-digests/${env}.txt`;

export type Result =
  | { state: "checking" }
  | { state: "verified"; digest: string; hardware: string; at: Date; commit: string; commitUrl: string; buildUrl: string }
  | { state: "failed"; reason: string; retryable?: boolean };

type Claims = {
  swname?: string;
  dbgstat?: string;
  hwmodel?: string;
  eat_nonce?: string[];
  submods?: { container?: { image_digest?: string; env?: { MALOTE_ENV?: string } }; confidential_space?: { support_attributes?: string[] } };
};

async function verify(enclaveUrl: string, env: string): Promise<Result> {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(`${enclaveUrl}/v1/attestation?nonce=${nonce}`, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { state: "failed", reason: "O enclave não respondeu com uma prova. Vamos tentar novamente.", retryable: res.status === 429 || res.status >= 500 };
  const { token } = (await res.json()) as { token: string };
  let p: Claims;
  try {
    p = (
      await jwtVerify(token, googleKeys, {
        issuer: "https://confidentialcomputing.googleapis.com",
        audience: "https://malote.io/verify",
      })
    ).payload as Claims;
  } catch (error) {
    return signatureFailure(error);
  }
  if (p.swname !== "CONFIDENTIAL_SPACE") return { state: "failed", reason: "Não está rodando no Confidential Space." };
  if (p.dbgstat !== "disabled-since-boot") return { state: "failed", reason: "O modo de depuração está ligado." };
  if (!p.submods?.confidential_space?.support_attributes?.includes("STABLE")) {
    return { state: "failed", reason: "A imagem do Confidential Space não é uma versão estável." };
  }
  if (!p.eat_nonce?.includes(nonce)) return { state: "failed", reason: "A prova não é desta verificação (nonce diferente)." };
  if (p.submods?.container?.env?.MALOTE_ENV !== env) return { state: "failed", reason: "A prova não corresponde ao ambiente consultado." };
  const digest = p.submods?.container?.image_digest ?? "";
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) return { state: "failed", reason: "A prova não contém um digest válido." };
  const provenanceResponse = await fetch(`/api/verification?digest=${encodeURIComponent(digest)}&env=${encodeURIComponent(env)}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!provenanceResponse.ok) {
    return { state: "failed", reason: provenanceResponse.status === 422 ? "A imagem não tem uma proveniência válida na lista pública." : "A consulta ao build está indisponível. Vamos tentar novamente.", retryable: provenanceResponse.status !== 422 };
  }
  const provenance = await provenanceResponse.json();
  if (provenance.digest !== digest || !/^[a-f0-9]{40}$/.test(provenance.commit) || !/^https:\/\/github\.com\/Malote-MCP\/malote\/actions\/runs\/\d+(\/attempts\/\d+)?$/.test(provenance.buildUrl)) return { state: "failed", reason: "A proveniência não corresponde à imagem atestada." };
  return { state: "verified", digest, hardware: p.hwmodel ?? "", at: new Date(), commit: provenance.commit, commitUrl: provenance.commitUrl, buildUrl: provenance.buildUrl };
}


// Both badges share a fresh challenge. Failed requests are never cached for the next attempt.
const requests = new Map<string, { at: number; promise: Promise<Result> }>();
const retryEvent = "malote-verification-retry";
export function retryEnclaveVerification() {
  requests.clear();
  window.dispatchEvent(new Event(retryEvent));
}

export function useEnclaveVerification(enclaveUrl: string | null, env: string | null) {
  const [result, setResult] = useState<Result>({ state: "checking" });
  useEffect(() => {
    if (!enclaveUrl || !env) return;
    let active = true;
    let generation = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      const current = ++generation;
      clearTimeout(timer);
      setResult({ state: "checking" });
      const key = `${env}:${enclaveUrl}`;
      let request = requests.get(key);
      if (!request || Date.now() - request.at > 10_000) {
        request = { at: Date.now(), promise: verify(enclaveUrl, env).catch((): Result => ({ state: "failed", reason: "A consulta demorou ou a conexão falhou. Vamos tentar novamente.", retryable: true })) };
        requests.set(key, request);
      }
      const value = await request.promise;
      if (!active || current !== generation) return;
      setResult(value);
      if (value.state === "failed" && requests.get(key) === request) requests.delete(key);
      timer = setTimeout(check, value.state === "failed" && value.retryable ? 15_000 : 300_000);
    };
    const retry = () => { void check(); };
    const resume = () => { if (document.visibilityState === "visible") { void check(); } };
    void check();
    window.addEventListener(retryEvent, retry);
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener(retryEvent, retry);
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [enclaveUrl, env]);
  return result;
}
