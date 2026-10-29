"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Logo } from "./logo";

type Status = {
  status: "pending" | "qr" | "connected" | "logged_out" | "error";
  enabled: boolean;
  phone: string | null;
  name: string | null;
  qr: string | null;
  lastSeenAt: string | null;
  error: string | null;
};

type Token = { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null };

function formatPhone(p: string | null) {
  if (!p) return "";
  const m = p.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : `+${p}`;
}

function ConnectionCard({ hasKey }: { hasKey: boolean }) {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/whatsapp", { cache: "no-store" });
    if (res.ok) setS(await res.json());
  }, []);

  const waiting = !!s && s.enabled && s.status !== "connected" && s.status !== "error";
  useEffect(() => {
    void load();
    const t = setInterval(load, waiting ? 2000 : 15000);
    return () => clearInterval(t);
  }, [load, waiting]);

  async function act(action: "connect" | "logout") {
    if (action === "logout" && !confirm("Desconectar o WhatsApp do Malote?")) return;
    setBusy(true);
    await fetch("/api/whatsapp", { method: "POST", body: JSON.stringify({ action }) });
    setTimeout(() => {
      void load();
      setBusy(false);
    }, 1500);
  }

  return (
    <section className="rounded-3xl border border-line bg-white/70 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">2. WhatsApp</h2>
          <p className="mt-1 text-sm text-ink-3">O Malote entra como um aparelho vinculado, igual ao WhatsApp Web.</p>
        </div>
        {s?.status === "connected" ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-moss-soft px-3 py-1 text-sm font-medium text-moss">
            <span className="h-2 w-2 rounded-full bg-moss" /> Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-paper-2 px-3 py-1 text-sm text-ink-2">
            <span className="h-2 w-2 rounded-full bg-ink-3" /> {waiting ? "Aguardando" : "Desconectado"}
          </span>
        )}
      </div>

      {!s && <p className="mt-6 text-ink-3">Carregando…</p>}

      {s?.status === "connected" && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-paper p-5">
          <div>
            <p className="font-semibold">{s.name ?? "Sua conta"}</p>
            <p className="text-ink-2">{formatPhone(s.phone)}</p>
          </div>
          <button
            onClick={() => act("logout")}
            disabled={busy}
            className="rounded-full border border-line px-4 py-2 text-sm hover:bg-paper-2 disabled:opacity-60"
          >
            Desconectar
          </button>
        </div>
      )}

      {s && s.status !== "connected" && (
        <div className="mt-6 grid items-center gap-8 md:grid-cols-[auto_1fr]">
          <div className="flex h-[260px] w-[260px] items-center justify-center rounded-2xl border border-line bg-white">
            {s.qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.qr} alt="QR code para conectar o WhatsApp" width={240} height={240} />
            ) : waiting ? (
              <p className="px-6 text-center text-sm text-ink-3">Gerando QR code…</p>
            ) : !hasKey ? (
              <p className="px-6 text-center text-sm text-ink-3">Gere seu token (passo 1) antes de conectar.</p>
            ) : (
              <button
                onClick={() => act("connect")}
                disabled={busy}
                className="rounded-full bg-moss px-5 py-2.5 font-medium text-paper hover:bg-moss-2 disabled:opacity-60"
              >
                Gerar QR code
              </button>
            )}
          </div>
          <div>
            <ol className="space-y-3 text-ink-2">
              <li>
                <b className="text-ink">1.</b> Abra o WhatsApp no celular.
              </li>
              <li>
                <b className="text-ink">2.</b> Toque em <b>Configurações → Aparelhos conectados → Conectar aparelho</b>.
              </li>
              <li>
                <b className="text-ink">3.</b> Aponte a câmera para o QR code ao lado.
              </li>
            </ol>
            {s.error && <p className="mt-4 rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay">{s.error}</p>}
            <p className="mt-4 text-xs leading-relaxed text-ink-3">
              Cliente não oficial: há risco de restrição da conta pelo WhatsApp. O Malote limita envios e só envia para
              conversas existentes para reduzir esse risco.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-xs font-medium text-moss hover:underline"
        >
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-ink px-4 py-3 font-mono text-[12.5px] leading-relaxed text-paper">
        {value}
      </pre>
    </div>
  );
}

/**
 * Token endpoints. With an enclave, the browser talks to it directly (signed in via the Neon Auth JWT),
 * so new tokens never pass through the web server.
 */
async function tokensFetch(enclaveUrl: string | null, path: "" | `/${string}`, init: RequestInit = {}) {
  if (!enclaveUrl) {
    const legacy = path ? `/api/tokens?id=${path.slice(1)}` : "/api/tokens";
    return fetch(legacy, { cache: "no-store", ...init });
  }
  const jwt = (await authClient.token()).data?.token;
  return fetch(`${enclaveUrl}/v1/tokens${path}`, {
    cache: "no-store",
    ...init,
    headers: { authorization: `Bearer ${jwt ?? ""}`, "content-type": "application/json" },
  });
}

function McpCard({ hasKey, onKey, enclaveUrl }: { hasKey: boolean; onKey: (v: boolean) => void; enclaveUrl: string | null }) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://malote.io");

  const load = useCallback(async () => {
    const res = await tokensFetch(enclaveUrl, "");
    if (!res.ok) return;
    const body = (await res.json()) as { tokens: Token[]; hasKey: boolean };
    setTokens(body.tokens);
    onKey(body.hasKey);
  }, [onKey, enclaveUrl]);

  useEffect(() => {
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  async function create() {
    const name = prompt("Nome do token (ex.: Claude Code no notebook)", "Claude");
    if (name === null) return;
    let body: { name: string; authorizeWith?: string; reset?: boolean } = { name };
    if (hasKey) {
      // The token unlocks the encryption key, so a new one has to be authorized by an existing one.
      const existing = prompt(
        "Seu histórico é cifrado com uma chave que só os seus tokens destravam. Cole um token atual para autorizar o novo (o mesmo token também serve em vários clientes). Deixe vazio se perdeu todos.",
      );
      if (existing === null) return;
      if (existing.trim()) body = { name, authorizeWith: existing.trim() };
      else if (
        confirm(
          "Sem um token atual não há como abrir seu histórico cifrado: ele será apagado e uma chave nova será criada. Todos os tokens atuais deixam de funcionar. Para recuperar o histórico, desconecte e conecte o WhatsApp de novo. Continuar?",
        )
      )
        body = { name, reset: true };
      else return;
    }
    const res = await tokensFetch(enclaveUrl, "", { method: "POST", body: JSON.stringify(body) });
    if (res.ok) {
      setFresh((await res.json()).token);
      void load();
    } else {
      alert(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Não foi possível gerar o token.");
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revogar este token? Clientes usando ele perdem o acesso.")) return;
    await tokensFetch(enclaveUrl, `/${id}`, { method: "DELETE" });
    void load();
  }

  const url = enclaveUrl ? `${enclaveUrl}/mcp` : `${origin}/api/mcp`;
  const token = fresh ?? "SEU_TOKEN";
  const claudeCode = `claude mcp add --transport http malote ${url} \\\n  --header "Authorization: Bearer ${token}"`;
  const desktop = JSON.stringify(
    {
      mcpServers: {
        malote: {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization: Bearer ${MALOTE_TOKEN}"],
          env: { MALOTE_TOKEN: token },
        },
      },
    },
    null,
    2,
  );

  return (
    <section className="rounded-3xl border border-line bg-white/70 p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">1. Token do Claude</h2>
          <p className="mt-1 text-sm text-ink-3">
            O token dá acesso ao seu WhatsApp via MCP e é a chave que decifra seu histórico. Nem o Malote consegue ler sem
            ele. Guarde como uma senha: se perder todos, o histórico guardado não pode ser recuperado.
          </p>
        </div>
        <button onClick={create} className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink-2">
          Gerar token
        </button>
      </div>

      {fresh && (
        <div className="mt-6 rounded-2xl border border-moss/30 bg-moss-soft p-4">
          <p className="text-sm font-medium text-moss">Copie agora: este token não será mostrado de novo, e não temos como recuperá-lo.</p>
          <code className="mt-2 block break-all font-mono text-sm">{fresh}</code>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="mt-6 divide-y divide-line rounded-2xl border border-line">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{t.name}</p>
                <p className="font-mono text-xs text-ink-3">
                  {t.prefix}… · {t.lastUsedAt ? `usado ${new Date(t.lastUsedAt).toLocaleString("pt-BR")}` : "nunca usado"}
                </p>
              </div>
              <button onClick={() => revoke(t.id)} className="text-xs font-medium text-clay hover:underline">
                Revogar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8 space-y-6">
        <CopyBlock label="Claude Code" value={claudeCode} />
        <CopyBlock label="Claude Desktop (claude_desktop_config.json)" value={desktop} />
        <p className="text-xs text-ink-3">
          Endereço do servidor MCP: <code className="font-mono">{url}</code> (Streamable HTTP, autenticação por Bearer token).
        </p>
      </div>
    </section>
  );
}

export function Dashboard({ name, enclaveUrl = null }: { name: string; enclaveUrl?: string | null }) {
  const router = useRouter();
  const [hasKey, setHasKey] = useState(false);
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo href="/app" />
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-ink-3 sm:inline">{name}</span>
          <button
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
            className="rounded-full border border-line px-4 py-2 hover:bg-paper-2"
          >
            Sair
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-4 sm:px-6">
        <McpCard hasKey={hasKey} onKey={setHasKey} enclaveUrl={enclaveUrl} />
        <ConnectionCard hasKey={hasKey} />
      </main>
    </div>
  );
}
