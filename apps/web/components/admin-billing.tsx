"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Toggle on the admin user list: free forever, or back to trial/plan rules. */
export function FreeToggle({ userId, freeForever }: { userId: string; freeForever: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-3">
      <input
        type="checkbox"
        checked={freeForever}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          await fetch("/api/admin/billing", { method: "POST", body: JSON.stringify({ userId, freeForever: e.target.checked }) }).catch(() => null);
          setBusy(false);
          router.refresh();
        }}
      />
      grátis sempre
    </label>
  );
}
