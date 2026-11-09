"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUp, Plus } from "lucide-react";
import { CreateUnitForm } from "./units/CreateUnitForm";
import { refreshUnits, useUnits } from "./units/useUnits";
import { Button, ErrorText, Spinner, cx, inputClass } from "./ui";

const UNIT_KEY = "exam-helper:upload-unit";

/**
 * Upload lecture PDFs into a unit. With `unitId` (on a unit's page) files go
 * straight there; otherwise the student picks or creates a unit first, and the
 * drop area stays inactive until they do.
 */
export function UploadDropzone({ unitId: lockedUnitId }: { unitId?: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const selectId = useId();
  const { units } = useUnits();
  const [chosen, setChosen] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Restore the last unit uploaded to, if it still exists.
  useEffect(() => {
    if (lockedUnitId || !units || chosen) return;
    let saved = "";
    try {
      saved = localStorage.getItem(UNIT_KEY) ?? "";
    } catch {
      /* ignore */
    }
    const pick = units.find((u) => u.id === saved) ?? (units.length === 1 ? units[0] : undefined);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pick) setChosen(pick.id);
  }, [units, lockedUnitId, chosen]);

  const unitId = lockedUnitId ?? (units?.some((u) => u.id === chosen) ? chosen : "");
  const noUnits = !lockedUnitId && units !== null && units.length === 0;
  const ready = !!unitId && !busy;

  function choose(id: string) {
    setChosen(id);
    setError(null);
    try {
      localStorage.setItem(UNIT_KEY, id);
    } catch {
      /* ignore */
    }
  }

  function needUnit() {
    setError(noUnits ? "Create a unit first, then add its PDFs." : "Choose which unit these PDFs belong to first.");
    selectRef.current?.focus();
  }

  async function upload(files: File[]) {
    if (!unitId) return needUnit();
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) {
      setError("Please choose a PDF file.");
      return;
    }
    setError(null);
    let lastId: string | null = null;
    const errors: string[] = [];
    for (const [i, file] of pdfs.entries()) {
      setBusy(pdfs.length > 1 ? `Processing ${i + 1} of ${pdfs.length}: ${file.name}` : `Processing ${file.name}`);
      setProgress({ done: i, total: pdfs.length });
      const body = new FormData();
      body.append("file", file);
      body.append("unitId", unitId);
      try {
        const res = await fetch("/api/documents", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) errors.push(json.error ?? `Upload of ${file.name} failed`);
        else lastId = json.id;
      } catch {
        errors.push(`Upload of ${file.name} failed`);
      }
    }
    setBusy(null);
    setProgress(null);
    refreshUnits();
    if (errors.length) setError(errors.join(" "));
    if (pdfs.length === 1 && lastId) router.push(`/documents/${lastId}`);
    else router.refresh();
  }

  const zone = (
    <button
      type="button"
      disabled={!!busy}
      aria-disabled={!unitId}
      onClick={() => (unitId ? inputRef.current?.click() : needUnit())}
      onDragOver={(e) => {
        e.preventDefault();
        if (unitId) setDragging(true);
      }}
      onDragLeave={(e) => {
        // Moving onto a child also fires dragleave; only reset when leaving the zone.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) upload([...e.dataTransfer.files]);
      }}
      className={cx(
        "group relative flex w-full flex-col items-center gap-5 overflow-hidden rounded-xl border border-dashed px-6 py-10 text-center transition-[border-color,background-color,opacity] duration-200 disabled:cursor-progress sm:flex-row sm:px-8 sm:py-8 sm:text-left",
        dragging
          ? "border-solid border-foreground bg-sunken"
          : ready
            ? "border-line-strong hover:border-zinc-400 hover:bg-sunken dark:hover:border-zinc-600"
            : "border-line-strong",
        !unitId && !busy && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        aria-hidden
        className={cx(
          "grid size-12 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-300 ease-(--ease-out-expo)",
          dragging || busy
            ? "bg-foreground text-background"
            : cx("border border-line-strong text-foreground", ready && "group-hover:-translate-y-0.5"),
          dragging && "-translate-y-1 scale-105",
        )}
      >
        {busy ? <Spinner className="size-5" /> : <ArrowUp className="size-5" strokeWidth={1.75} />}
      </span>

      <span className="min-w-0 flex-1">
        {busy ? (
          <span className="text-shimmer block truncate text-[15px] font-medium" aria-live="polite">
            {busy}
          </span>
        ) : (
          <>
            <span className="block text-[15px] font-medium">
              {dragging ? "Release to upload" : unitId ? "Drop lecture PDFs here" : "Choose a unit to upload PDFs"}
            </span>
            <span className="mt-0.5 block text-sm text-subtle">
              Slides, notes or handouts, up to 100 MB each. Several at once is fine.
            </span>
          </>
        )}
      </span>

      {!busy && (
        <span
          aria-hidden
          className={cx(
            "inline-flex h-9 items-center rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium transition-colors",
            ready && "group-hover:border-foreground",
          )}
        >
          Browse files
        </span>
      )}

      {progress && progress.total > 1 && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-line">
          <span
            className="block h-full bg-foreground transition-[width] duration-500 ease-(--ease-out-expo)"
            style={{ width: `${((progress.done + 0.5) / progress.total) * 100}%` }}
          />
        </span>
      )}
    </button>
  );

  return (
    <div className="animate-fade-up [animation-delay:60ms]">
      {lockedUnitId ? (
        zone
      ) : (
        <div className="rounded-xl border border-line">
          <div className="border-b border-line px-4 py-3.5 sm:px-5">
            {units === null ? (
              <div className="h-9 w-64 max-w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
            ) : noUnits || creating ? (
              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium">{noUnits ? "Start with a unit" : "New unit"}</div>
                  <p className="mt-0.5 text-[13px] text-subtle">
                    Units keep each course&apos;s lectures and question sets together.
                  </p>
                </div>
                <CreateUnitForm
                  autoFocus={!noUnits}
                  onCreated={(u) => {
                    choose(u.id);
                    setCreating(false);
                    router.refresh();
                  }}
                  onCancel={noUnits ? undefined : () => setCreating(false)}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label htmlFor={selectId} className="text-sm font-medium">
                  Upload to
                </label>
                <select
                  id={selectId}
                  ref={selectRef}
                  value={unitId}
                  onChange={(e) => choose(e.target.value)}
                  className={cx(inputClass, "py-2 sm:w-72")}
                >
                  <option value="" disabled>
                    Choose a unit…
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code ? `${u.code} · ${u.name}` : u.name}
                    </option>
                  ))}
                </select>
                <Button variant="ghost" onClick={() => setCreating(true)} className="px-2.5">
                  <Plus className="size-4" /> New unit
                </Button>
              </div>
            )}
          </div>
          <div className="p-2">{zone}</div>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          upload([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="mt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </div>
  );
}
