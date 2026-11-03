"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  userId: string;
  perMinute: number | null;
  perDay: number | null;
  caps: { perMinute: number; perDay: number };
  placeholder: { perMinute: number; perDay: number };
  compact?: boolean;
};

/** Edits the default limits (userId "*") or one user's override. Empty fields fall back to the default. */
export function LimitsForm({ userId, perMinute, perDay, caps, placeholder, compact = false }: Props) {
  const router = useRouter();
  const [min, setMin] = useState(perMinute?.toString() ?? "");
  const [day, setDay] = useState(perDay?.toString() ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | { error: string }>("idle");
  const dirty = min !== (perMinute?.toString() ?? "") || day !== (perDay?.toString() ?? "");

  async function save() {
    setState("saving");
    const res = await fetch("/api/admin/limits", {
      method: "POST",
      body: JSON.stringify({ userId, perMinute: min, perDay: day }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => null)) as { error?: string } | null;
      setState({ error: body?.error ?? "Não foi possível salvar." });
      return;
    }
    setState("saved");
    router.refresh();
  }

  const input = compact
    ? "w-16 rounded-lg border border-line bg-white px-2 py-1 text-right text-sm tabular-nums"
    : "field w-28 text-right tabular-nums";
  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-wrap items-end gap-4"}>
      <label className={compact ? "flex items-center gap-1 text-xs text-ink-3" : "block text-sm text-ink-2"}>
        {compact ? null : <span className="block">Por minuto (máx. {caps.perMinute})</span>}
        <input
          className={input}
          inputMode="numeric"
          value={min}
          placeholder={String(placeholder.perMinute)}
          onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
          aria-label="Envios por minuto"
        />
        {compact && "/min"}
      </label>
      <label className={compact ? "flex items-center gap-1 text-xs text-ink-3" : "block text-sm text-ink-2"}>
        {compact ? null : <span className="block">Por dia (máx. {caps.perDay})</span>}
        <input
          className={input}
          inputMode="numeric"
          value={day}
          placeholder={String(placeholder.perDay)}
          onChange={(e) => setDay(e.target.value.replace(/\D/g, ""))}
          aria-label="Envios por dia"
        />
        {compact && "/dia"}
      </label>
      <button
        onClick={save}
        disabled={!dirty || state === "saving"}
        className={
          compact
            ? "rounded-full border border-line px-3 py-1 text-xs hover:bg-paper-2 disabled:opacity-40"
            : "rounded-full bg-moss px-4 py-2 text-sm font-medium text-paper hover:bg-moss-2 disabled:opacity-50"
        }
      >
        {state === "saving" ? "Salvando…" : "Salvar"}
      </button>
      {state === "saved" && !dirty && <span className="text-xs text-moss">Salvo</span>}
      {typeof state === "object" && <span className="text-xs text-clay">{state.error}</span>}
    </div>
  );
}
