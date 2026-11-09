"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Spinner, cx, inputClass } from "../ui";
import { refreshUnits } from "./useUnits";

/** A unit's course code, shown as a label and edited in place. */
export function UnitCodeField({ unitId, code }: { unitId: string; code: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(code ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    await fetch(`/api/units/${unitId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: draft.trim() }),
    });
    setBusy(false);
    setEditing(false);
    refreshUnits();
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(code ?? "");
          setEditing(true);
        }}
        className="group inline-flex min-h-7 items-center gap-1.5 rounded-md text-xs text-subtle transition-colors hover:text-foreground"
        title="Edit course code"
      >
        <span className={cx("font-mono", code && "rounded-full border border-line-strong px-2 py-px text-muted")}>
          {code ?? "Add course code"}
        </span>
        <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        aria-label="Course code"
        className={cx(inputClass, "w-36 py-1 font-mono text-xs")}
        value={draft}
        maxLength={32}
        autoFocus
        placeholder="e.g. CS2010"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        type="button"
        onClick={save}
        disabled={busy}
        aria-label="Save code"
        className="grid size-7 place-items-center rounded-md text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900"
      >
        {busy ? <Spinner className="size-3.5" /> : <Check className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancel"
        className="grid size-7 place-items-center rounded-md text-subtle hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900"
      >
        <X className="size-4" />
      </button>
    </span>
  );
}
