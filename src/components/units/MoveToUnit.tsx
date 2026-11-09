"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Spinner, cx, inputClass } from "../ui";
import { refreshUnits, useUnits } from "./useUnits";

/** Moves a document to another unit. */
export function MoveToUnit({ documentId, unitId }: { documentId: string; unitId: string }) {
  const router = useRouter();
  const id = useId();
  const { units } = useUnits();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!units || units.length < 2) return null;

  async function move(next: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId: next }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error ?? "Could not move it.");
      return;
    }
    refreshUnits();
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2 text-[13px]">
      <label htmlFor={id} className="whitespace-nowrap text-subtle">
        Move to
      </label>
      <select
        id={id}
        value={unitId}
        disabled={busy}
        onChange={(e) => move(e.target.value)}
        className={cx(inputClass, "w-auto max-w-56 py-1 text-[13px]")}
      >
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.code ? `${u.code} · ${u.name}` : u.name}
          </option>
        ))}
      </select>
      {busy && <Spinner className="size-3.5 text-subtle" />}
      {error && (
        <span role="alert" className="text-red-700 dark:text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}
