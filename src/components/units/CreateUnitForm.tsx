"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import type { UnitRecord } from "@/lib/types";
import { Button, ErrorText, Spinner, cx, inputClass } from "../ui";
import { createUnit } from "./useUnits";

/** Name and optional course code for a new unit. Calls onCreated with the saved unit. */
export function CreateUnitForm({
  onCreated,
  onCancel,
  autoFocus = true,
  compact = false,
}: {
  onCreated: (unit: UnitRecord) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  /** Stacked fields for narrow spaces like the sidebar. */
  compact?: boolean;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      setError("Give the unit a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const unit = await createUnit(name.trim(), code.trim());
      setName("");
      setCode("");
      onCreated(unit);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    // A div, not a form: this can sit inside other forms and buttons' parents.
    <div
      className="animate-fade-up space-y-2"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape" && onCancel) {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className={cx("grid gap-2", !compact && "sm:grid-cols-[1fr_9rem]")}>
        <label className="block">
          <span className="sr-only">Unit name</span>
          <input
            className={cx(inputClass, compact && "py-2")}
            placeholder="Unit name, e.g. Databases"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            autoFocus={autoFocus}
            aria-invalid={!!error}
          />
        </label>
        <label className="block">
          <span className="sr-only">Course code (optional)</span>
          <input
            className={cx(inputClass, "font-mono", compact && "py-2")}
            placeholder="Code (optional)"
            value={code}
            maxLength={32}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      <div className="flex items-center gap-2">
        <Button onClick={submit} disabled={busy} className={compact ? "min-h-8 px-3 py-1" : undefined}>
          {busy ? <Spinner /> : <Plus className="size-4" />}
          Create unit
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className={compact ? "min-h-8 px-3 py-1" : undefined}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
