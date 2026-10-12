"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { ErrorText, Spinner, cx } from "./ui";

export function UploadDropzone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(files: File[]) {
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
      const body = new FormData();
      body.append("file", file);
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
    if (errors.length) setError(errors.join(" "));
    if (pdfs.length === 1 && lastId) router.push(`/documents/${lastId}`);
    else router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
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
          "group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors duration-200 disabled:cursor-progress",
          dragging
            ? "border-brand-500 bg-brand-50 dark:bg-brand-950/40"
            : "border-zinc-300 bg-white hover:border-brand-400 hover:bg-brand-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/20",
        )}
      >
        {busy ? (
          <>
            <Spinner className="size-6 text-brand-600" />
            <span className="text-sm text-zinc-600 dark:text-zinc-300" aria-live="polite">
              {busy}
            </span>
          </>
        ) : (
          <>
            <span
              className={cx(
                "grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-transform duration-200 group-hover:-translate-y-0.5 dark:bg-brand-950 dark:text-brand-300",
                dragging && "-translate-y-1 scale-105",
              )}
            >
              <FileUp className="size-7" aria-hidden />
            </span>
            <span className="font-semibold">
              {dragging ? "Drop to upload" : (
                <>
                  Drop lecture PDFs here, or <span className="text-brand-600 dark:text-brand-400">browse</span>
                </>
              )}
            </span>
            <span className="text-sm text-muted">Slides, notes, handouts. Up to 100 MB each</span>
          </>
        )}
      </button>
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
