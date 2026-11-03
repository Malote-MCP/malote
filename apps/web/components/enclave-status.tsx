"use client";

import { retryEnclaveVerification, allowedDigestsUrl, useEnclaveVerification } from "@/lib/enclave-verification";

export function EnclaveStatus({ enclaveUrl, env }: { enclaveUrl: string | null; env: string | null }) {
  const result = useEnclaveVerification(enclaveUrl, env);

  if (!enclaveUrl || !env) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper px-4 py-3 text-sm">
        <span aria-hidden="true" className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-ink-3" />
        <p className="text-ink-2">
          <strong className="text-ink">Verificação não configurada.</strong> Este ambiente não informou o endereço e o nome do enclave a consultar.
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
          <strong className="text-clay">Não verificado.</strong> {result.reason} <button type="button" className="underline" onClick={retryEnclaveVerification}>Verificar novamente</button>
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
          <span className="text-ink-2"> · digest do enclave ligado ao commit público por uma proveniência assinada</span>
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
        <li>Commit <a href={result.commitUrl} className="underline">{result.commit.slice(0, 7)}</a> · <a href={result.buildUrl} className="underline">Build no GitHub</a>. Proveniência validada pelo servidor com Sigstore; atestação do Google validada neste navegador.</li>
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
