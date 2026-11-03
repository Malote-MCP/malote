"use client";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { useEffect, useState } from "react";

const GOOGLE_JWKS = "https://www.googleapis.com/service_accounts/v1/metadata/jwk/signer@confidentialspace-sign.iam.gserviceaccount.com";
export const allowedDigestsUrl = (env: string) =>
  `https://raw.githubusercontent.com/Malote-MCP/malote/main/infra/gcp/allowed-digests/${env}.txt`;

export type Result =
  | { state: "checking" }
  | { state: "verified"; digest: string; hardware: string; at: Date; commit: string; commitUrl: string; buildUrl: string }
  | { state: "failed"; reason: string };

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
  if (!res.ok) return { state: "failed", reason: "O enclave não respondeu com uma prova." };
  const { token } = (await res.json()) as { token: string };
  let p: Claims;
  try {
    p = (
      await jwtVerify(token, createRemoteJWKSet(new URL(GOOGLE_JWKS)), {
        issuer: "https://confidentialcomputing.googleapis.com",
        audience: "https://malote.io/verify",
      })
    ).payload as Claims;
  } catch {
    return { state: "failed", reason: "A assinatura do Google na prova não confere." };
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
  const response = await fetch(allowedDigestsUrl(env), { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) return { state: "failed", reason: "A lista pública está indisponível." };
  const list = await response.text();
  if (!list.split("\n").some((line) => line.trim().split(/\s+/).at(-1) === digest)) {
    return { state: "failed", reason: "A imagem em execução não está na lista pública do repositório." };
  }
  const provenanceResponse = await fetch(`/api/verification?digest=${encodeURIComponent(digest)}&env=${encodeURIComponent(env)}`, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  if (!provenanceResponse.ok) return { state: "failed", reason: "Não foi possível ligar a imagem a uma proveniência assinada do GitHub." };
  const provenance = await provenanceResponse.json();
  if (provenance.digest !== digest || !/^[a-f0-9]{40}$/.test(provenance.commit) || !/^https:\/\/github\.com\/Malote-MCP\/malote\/actions\/runs\/\d+(\/attempts\/\d+)?$/.test(provenance.buildUrl)) return { state: "failed", reason: "A proveniência não corresponde à imagem atestada." };
  return { state: "verified", digest, hardware: p.hwmodel ?? "", at: new Date(), commit: provenance.commit, commitUrl: provenance.commitUrl, buildUrl: provenance.buildUrl };
}


// Both badges share the same fresh challenge instead of firing duplicate requests.
const requests = new Map<string, { at: number; promise: Promise<Result> }>();
export function useEnclaveVerification(enclaveUrl: string | null, env: string | null) {
  const [result, setResult] = useState<Result>({ state: "checking" });
  useEffect(() => {
    if (!enclaveUrl || !env) return;
    let active = true;
    const check = () => {
      setResult({ state: "checking" });
      const key = `${env}:${enclaveUrl}`;
      let request = requests.get(key);
      if (!request || Date.now() - request.at > 60_000) {
        request = { at: Date.now(), promise: verify(enclaveUrl, env).catch((): Result => ({ state: "failed", reason: "Não foi possível consultar as provas agora." })) };
        requests.set(key, request);
      }
      request.promise.then(value => { if (active) setResult(value); });
    };
    check();
    const interval = setInterval(check, 300_000);
    return () => { active = false; clearInterval(interval); };
  }, [enclaveUrl, env]);
  return result;
}
