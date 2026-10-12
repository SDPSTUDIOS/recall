"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Spinner, cx } from "./ui";

/** A page title that turns into an input when clicked, saved with PATCH. */
export function EditableTitle({
  value,
  url,
  field,
  className,
}: {
  value: string;
  url: string;
  field: "title" | "name";
  className?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = draft.trim();
    if (!next || next === value) {
      setEditing(false);
      setDraft(value);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not rename");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <h1 className={cx("group flex min-w-0 items-start gap-2", className)}>
        <span className="min-w-0 break-words">{value}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(value);
            setEditing(true);
          }}
          className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md text-subtle opacity-100 transition hover:bg-zinc-100 hover:text-zinc-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          aria-label="Rename"
          title="Rename"
        >
          <Pencil className="size-3.5" />
        </button>
      </h1>
    );
  }

  return (
    <form
      className="w-full max-w-xl"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <div className="flex items-center gap-1">
        <input
          autoFocus
          aria-label="New name"
          value={draft}
          maxLength={field === "title" ? 120 : 200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setEditing(false);
              setDraft(value);
            }
          }}
          className={cx(
            "min-w-0 flex-1 rounded-lg border border-brand-400 bg-white px-2 py-1 outline-none ring-2 ring-brand-500/20 dark:bg-zinc-950",
            className,
          )}
        />
        <button
          type="submit"
          disabled={busy}
          className="grid size-8 place-items-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
          aria-label="Save name"
        >
          {busy ? <Spinner /> : <Check className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setDraft(value);
          }}
          className="grid size-8 place-items-center rounded-md text-muted hover:bg-zinc-100 dark:hover:bg-zinc-800"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
