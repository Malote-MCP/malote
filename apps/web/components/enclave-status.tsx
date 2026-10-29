"use client";

import { createRemoteJWKSet, jwtVerify } from "jose";
import { useEffect, useState } from "react";

/**
 * Checks, in the visitor's own browser, what the enclave is running: it sends a fresh nonce, verifies
 * Google's signature on the attestation token and compares the image digest with the public list of
 * digests in the repository. Nothing here trusts the Malote servers' word.
 */

const GOOGLE_JWKS = "https://www.googleapis.com/service_accounts/v1/metadata/jwk/signer@confidentialspace-sign.iam.gserviceaccount.com";
const allowedDigestsUrl = (env: string) =>
  `https://raw.githubusercontent.com/Malote-MCP/malote/main/infra/gcp/allowed-digests/${env}.txt`;

type Result =
  | { state: "checking" }
  | { state: "verified"; digest: string; hardware: string; at: Date }
  | { state: "failed"; reason: string };

type Claims = {
  swname?: string;
  dbgstat?: string;
  hwmodel?: string;
  eat_nonce?: string[];
  submods?: { container?: { image_digest?: string }; confidential_space?: { support_attributes?: string[] } };
};

async function verify(enclaveUrl: string, env: string): Promise<Result> {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  const res = await fetch(`${enclaveUrl}/v1/attestation?nonce=${nonce}`, { cache: "no-store" });
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
  const digest = p.submods?.container?.image_digest ?? "";
  const list = await (await fetch(allowedDigestsUrl(env), { cache: "no-store" })).text();
  if (!list.split("\n").some((line) => line.trim().endsWith(digest))) {
    return { state: "failed", reason: "A imagem em execução não está na lista pública do repositório." };
  }
  return { state: "verified", digest, hardware: p.hwmodel ?? "", at: new Date() };
}

export function EnclaveStatus({ enclaveUrl, env }: { enclaveUrl: string | null; env: string | null }) {
  const [result, setResult] = useState<Result>({ state: "checking" });

  useEffect(() => {
    if (!enclaveUrl || !env) return;
    verify(enclaveUrl, env)
      .then(setResult)
      .catch(() => setResult({ state: "failed", reason: "Não foi possível consultar o enclave agora." }));
  }, [enclaveUrl, env]);

  if (!enclaveUrl || !env) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
        <span aria-hidden="true" className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-ink-3" />
        <p className="text-ink-2">
          <strong className="text-ink">Ainda sem enclave.</strong> Este ambiente roda em servidores comuns. A verificação
          aparece aqui quando a migração para a máquina confidencial for concluída.
        </p>
      </div>
    );
  }

  if (result.state === "checking") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm text-ink-2" role="status">
        <span aria-hidden="true" className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-ink-3" />
        Verificando o enclave no seu navegador…
      </div>
    );
  }

  if (result.state === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm" role="alert">
        <span aria-hidden="true" className="font-semibold text-clay">✕</span>
        <p className="text-ink-2">
          <strong className="text-clay">Não verificado.</strong> {result.reason}
        </p>
      </div>
    );
  }

  return (
    <details className="group rounded-2xl border border-moss/30 bg-moss-soft px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3">
        <span aria-hidden="true" className="grid h-6 w-6 place-items-center rounded-full bg-moss text-xs font-bold text-paper">
          ✓
        </span>
        <span>
          <strong className="text-moss">Verificado</strong>
          <span className="text-ink-2"> · máquina confidencial rodando o código publicado, conferido agora no seu navegador</span>
        </span>
      </summary>
      <ul className="mt-3 space-y-1 pl-9 text-ink-2">
        <li>Prova assinada pelo Google (Confidential Space), com debug desligado.</li>
        <li>
          Imagem <code className="font-mono text-xs">{result.digest.slice(0, 19)}…</code>, presente na{" "}
          <a className="underline underline-offset-2" href={allowedDigestsUrl(env).replace("raw.githubusercontent.com", "github.com").replace("/main/", "/blob/main/")} target="_blank" rel="noopener noreferrer">
            lista pública do repositório
          </a>
          .
        </li>
        <li>Hardware {result.hardware === "GCP_AMD_SEV" ? "AMD SEV (memória cifrada)" : result.hardware}.</li>
        <li>Conferido às {result.at.toLocaleTimeString("pt-BR")} com um código aleatório gerado agora.</li>
        <li className="text-xs text-ink-3">
          O navegador não consegue checar a chave TLS da conexão; a verificação completa está em{" "}
          <code className="font-mono">apps/worker/scripts/verify-attestation.ts</code>.
        </li>
      </ul>
    </details>
  );
}
