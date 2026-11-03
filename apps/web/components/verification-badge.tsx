"use client";

import { useEnclaveVerification } from "@/lib/enclave-verification";

export function VerificationBadge({ placement }: { placement: "header" | "diagram" }) {
  const result = useEnclaveVerification("https://mcp.malote.io", "production");
  const verified = result.state === "verified";
  return (
    <details className={`site-verification site-verification-${placement}`} data-state={result.state}>
      <summary aria-live="polite">
        <span className="site-verification-mark" aria-hidden="true">{verified ? "✓" : result.state === "checking" ? "·" : "!"}</span>
        <span>{verified ? "Código ↔ imagem verificados" : result.state === "checking" ? "Conferindo código e imagem…" : "Verificação indisponível"}</span>
        <span className="site-verification-expand" aria-hidden="true">⌄</span>
      </summary>
      <div className="site-verification-proof">
        <strong>{verified ? "Do commit ao worker em execução." : "Uma prova real, consultada agora."}</strong>
        {result.state === "checking" && <p>Consultando a prova do Google e a proveniência assinada do build no GitHub.</p>}
        {result.state === "failed" && <p>{result.reason} Sem prova completa, o check não fica verde.</p>}
        {verified && <>
          <ol>
            <li>O Google atesta o digest do worker, com um desafio criado neste navegador.</li>
            <li>A assinatura do build liga esse mesmo digest ao commit público no GitHub.</li>
            <li>A imagem também consta na lista pública de produção.</li>
          </ol>
          <div className="site-verification-source"><a href={`https://github.com/Malote-MCP/malote/commit/${result.commit}`} target="_blank" rel="noopener noreferrer">Commit {result.commit.slice(0, 7)} ↗</a><a href={result.buildUrl} target="_blank" rel="noopener noreferrer">Build assinado ↗</a></div>
          <code>{result.digest}</code>
          <p>Conferido às {result.at.toLocaleTimeString("pt-BR")}. Atualiza a cada 5 min.</p>
          <p>A assinatura do Google é conferida no navegador; a proveniência, pelo servidor com Sigstore. Este check cobre o worker. O site e o painel rodam separadamente.</p>
        </>}
        <a className="site-verification-more" href="/seguranca#versao">Ver provas e limites ↗</a>
      </div>
    </details>
  );
}
