"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAccount({
  userId,
  email,
  disabled,
}: {
  userId: string;
  email: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open)
    return (
      <button
        type="button"
        disabled={disabled}
        title={
          disabled
            ? "Exclua sua própria conta pelas configurações em /app."
            : undefined
        }
        onClick={() => setOpen(true)}
        className="text-xs text-clay disabled:opacity-40"
      >
        Excluir conta
      </button>
    );
  return (
    <form
      className="min-w-52 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const res = await fetch("/api/admin/accounts", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, confirmation }),
          });
          if (!res.ok) {
            const result = await res.json().catch(() => null);
            throw new Error(result?.error ?? "Não foi possível excluir.");
          }
          setOpen(false);
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-xs text-clay">
        Exclui permanentemente a conta, tokens e histórico. Digite {email} para
        confirmar.
      </p>
      <input
        aria-label="E-mail para confirmar exclusão"
        className="field w-full"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        disabled={busy}
      />
      <div className="flex gap-3 text-xs">
        <button
          disabled={busy || confirmation !== email}
          className="text-clay disabled:opacity-40"
        >
          {busy ? "Excluindo…" : "Excluir permanentemente"}
        </button>
        <button type="button" disabled={busy} onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-clay">
          {error}
        </p>
      )}
    </form>
  );
}
