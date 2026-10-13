"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Eye, FileText, Minus, Plus, Sparkles } from "lucide-react";
import {
  MODEL_PRESETS,
  QUESTION_TYPES,
  type Effort,
  type GenerationConfig,
  type QuestionType,
} from "@/lib/types";
import { useClaudeStatus } from "./useClaudeStatus";
import { Badge, Button, Card, ErrorText, Spinner, ToggleGroup, cx, inputClass } from "./ui";

const PREFS_KEY = "exam-helper:generate-prefs";

type Counts = Record<QuestionType, number>;

type Prefs = {
  model: string;
  effort: Effort;
  counts: Counts;
  difficulty: GenerationConfig["difficulty"];
};

const PRESETS: { name: string; hint: string; counts: Counts }[] = [
  { name: "Quick check", hint: "10 short questions", counts: { mcq: 3, single: 5, fill_blank: 2, long_answer: 0, artifact: 0 } },
  // Artifacts suit every field (equations, graphs, data, cases or code), so the larger presets include them.
  { name: "Balanced", hint: "Every question type", counts: { mcq: 5, single: 5, fill_blank: 5, long_answer: 2, artifact: 2 } },
  { name: "Full exam", hint: "35 questions, exam length", counts: { mcq: 10, single: 10, fill_blank: 10, long_answer: 3, artifact: 2 } },
  { name: "Written & applied", hint: "Equations, graphs, cases and code", counts: { mcq: 0, single: 0, fill_blank: 0, long_answer: 3, artifact: 4 } },
];

const DEFAULT_PREFS: Prefs = {
  model: "sonnet",
  effort: "default",
  counts: PRESETS[1].counts,
  difficulty: "mixed",
};

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
];

const sameCounts = (a: Counts, b: Counts) => QUESTION_TYPES.every(({ type }) => a[type] === b[type]);

export interface DocumentOption {
  id: string;
  name: string;
  pageCount: number;
  /** Little extractable text: probably scanned, needs Visual mode. */
  lowText: boolean;
}

export function GenerateForm({
  documents,
  pickable = false,
}: {
  documents: DocumentOption[];
  /** Show a document picker (all selected initially). */
  pickable?: boolean;
}) {
  const router = useRouter();
  const { status } = useClaudeStatus();
  const [selectedIds, setSelectedIds] = useState(() => documents.map((d) => d.id));
  const selected = documents.filter((d) => selectedIds.includes(d.id));
  const single = selected.length === 1 ? selected[0] : null;
  const lowTextDocs = selected.filter((d) => d.lowText);
  const lowText = lowTextDocs.length > 0;
  const selectedPages = selected.reduce((n, d) => n + d.pageCount, 0);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [customModel, setCustomModel] = useState(false);
  const [title, setTitle] = useState("");
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [focus, setFocus] = useState("");
  const [mode, setMode] = useState<"text" | "visual">(lowText ? "visual" : "text");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the last-used model and mix (per-browser convenience only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
      if (saved) {
        const merged = { ...DEFAULT_PREFS, ...saved, counts: { ...DEFAULT_PREFS.counts, ...saved.counts } };
        // Restored after mount (not in the initial state) so the server render matches.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs(merged);
        setCustomModel(!MODEL_PRESETS.some((m) => m.value === merged.model));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = (patch: Partial<Prefs>) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const setCount = (type: QuestionType, n: number) =>
    update({ counts: { ...prefs.counts, [type]: Math.min(40, Math.max(0, n)) } });

  const total = Object.values(prefs.counts).reduce((a, b) => a + b, 0);
  const activePreset = PRESETS.find((p) => sameCounts(p.counts, prefs.counts));
  const modelLabel = MODEL_PRESETS.find((m) => m.value === prefs.model)?.label.replace(" (latest)", "") ?? prefs.model;
  const visualTooBig = mode === "visual" && !single && selectedPages > 200;
  const notConnected = status !== null && !status.loggedIn;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentIds: selected.map((d) => d.id),
          title,
          ...prefs,
          pageFrom: single ? Number(pageFrom) || 0 : 0,
          pageTo: single ? Number(pageTo) || 0 : 0,
          focus,
          mode,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not start generation");
      router.push(`/quizzes/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Routes stay mounted (hidden) after navigation, so reset for when the user comes back.
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <form onSubmit={submit}>
        <div className="space-y-7 p-5 sm:p-6">
          {pickable && (
            <Field
              label="Materials"
              hint={`${selected.length} of ${documents.length} selected · ${selectedPages} pages`}
              action={
                <button
                  type="button"
                  className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                  onClick={() =>
                    setSelectedIds(selected.length === documents.length ? [] : documents.map((d) => d.id))
                  }
                >
                  {selected.length === documents.length ? "Clear all" : "Select all"}
                </button>
              }
            >
              <div className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
                {documents.map((d) => {
                  const on = selectedIds.includes(d.id);
                  return (
                    <label
                      key={d.id}
                      className={cx(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                        on
                          ? "border-brand-300 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30"
                          : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={on}
                        onChange={(e) =>
                          setSelectedIds((ids) =>
                            e.target.checked ? [...ids, d.id] : ids.filter((id) => id !== d.id),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{d.name}</span>
                      {d.lowText && <Badge tone="amber">Scanned</Badge>}
                      <span className="shrink-0 text-xs tabular-nums text-muted">{d.pageCount} p.</span>
                    </label>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Questions" hint={`${total} in total`}>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  title={p.hint}
                  aria-pressed={activePreset === p}
                  onClick={() => update({ counts: p.counts })}
                  className={cx(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:py-2",
                    activePreset === p
                      ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                      : "border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600",
                  )}
                >
                  {p.name}
                </button>
              ))}
              {!activePreset && (
                <span className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-sm text-muted dark:border-zinc-700">
                  Custom
                </span>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {QUESTION_TYPES.map((t) => {
                const n = prefs.counts[t.type];
                return (
                  <div
                    key={t.type}
                    className={cx(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      n > 0
                        ? "border-brand-200 bg-brand-50/50 dark:border-brand-900 dark:bg-brand-950/30"
                        : "border-zinc-200 dark:border-zinc-800",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={cx("text-sm font-medium", n === 0 && "text-muted")}>{t.label}</div>
                      <div className="text-xs text-muted">{t.description}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <StepButton onClick={() => setCount(t.type, n - 1)} disabled={n === 0} label={`Fewer ${t.label}`}>
                        <Minus className="size-3.5" />
                      </StepButton>
                      <input
                        aria-label={`${t.label} count`}
                        inputMode="numeric"
                        value={n}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setCount(t.type, Number(e.target.value.replace(/\D/g, "")) || 0)}
                        className="w-11 rounded-md border border-zinc-300 bg-white py-1.5 text-center text-sm tabular-nums outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <StepButton onClick={() => setCount(t.type, n + 1)} disabled={n >= 40} label={`More ${t.label}`}>
                        <Plus className="size-3.5" />
                      </StepButton>
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>

          <Field label="Difficulty">
            <ToggleGroup
              label="Difficulty"
              value={prefs.difficulty}
              onChange={(d) => update({ difficulty: d })}
              options={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
                { value: "mixed", label: "Mixed" },
              ]}
            />
          </Field>

          <Field label="Claude model">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MODEL_PRESETS.map((m) => (
                <OptionCard
                  key={m.value}
                  active={!customModel && prefs.model === m.value}
                  onClick={() => {
                    setCustomModel(false);
                    update({ model: m.value });
                  }}
                  title={m.label.replace(" (latest)", "")}
                  text={m.hint}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-600"
                  checked={customModel}
                  onChange={(e) => {
                    setCustomModel(e.target.checked);
                    update({ model: e.target.checked ? "" : "sonnet" });
                  }}
                />
                Use a specific model ID
              </label>
              {customModel && (
                <input
                  className={cx(inputClass, "max-w-64 py-1.5")}
                  placeholder="e.g. claude-opus-5-5"
                  value={prefs.model}
                  onChange={(e) => update({ model: e.target.value.trim() })}
                  required
                  autoFocus
                />
              )}
            </div>
          </Field>

          <Field label="How Claude reads the material">
            <div className="grid gap-2 sm:grid-cols-2">
              <OptionCard
                active={mode === "text"}
                onClick={() => setMode("text")}
                icon={<FileText className="size-4" />}
                title="Text"
                text="Sends the extracted text. Fastest, and uses the least of your limits."
              />
              <OptionCard
                active={mode === "visual"}
                onClick={() => setMode("visual")}
                icon={<Eye className="size-4" />}
                title="Visual"
                text="Claude looks at the pages, including diagrams and scanned slides. Slower."
              />
            </div>
            {lowText && (
              <Warning>
                {lowTextDocs.length === 1 && selected.length === 1
                  ? "Very little text could be extracted. This PDF is probably scanned or image-based, so use Visual."
                  : `Very little text could be extracted from ${lowTextDocs.map((d) => `"${d.name}"`).join(", ")}. ${
                      lowTextDocs.length === 1 ? "It is" : "They are"
                    } probably scanned, so use Visual or leave ${lowTextDocs.length === 1 ? "it" : "them"} out.`}
              </Warning>
            )}
            {visualTooBig && (
              <Warning>Visual mode handles up to 200 pages per set. Select fewer materials or use Text.</Warning>
            )}
          </Field>

          <details className="group rounded-lg border border-zinc-200 dark:border-zinc-800">
            <summary className="flex cursor-pointer select-none list-none items-center justify-between px-3 py-2.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
              More options
              <span className="flex items-center gap-2 text-xs font-normal text-muted">
                {single ? "Pages, focus, effort, title" : "Focus, effort, title"}
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="grid gap-4 border-t border-zinc-200 p-3 sm:grid-cols-2 dark:border-zinc-800">
              {single && (
                <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                  <label className="space-y-1.5">
                    <span className="text-sm">From page</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      placeholder="1"
                      value={pageFrom}
                      onChange={(e) => setPageFrom(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm">To page</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      placeholder={String(single.pageCount)}
                      value={pageTo}
                      onChange={(e) => setPageTo(e.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                </div>
              )}
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm">Focus topics</span>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="e.g. normalisation, ER diagrams, transaction isolation"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm">Title</span>
                <input
                  className={inputClass}
                  placeholder="Named automatically"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm">Effort</span>
                <select
                  className={inputClass}
                  value={prefs.effort}
                  onChange={(e) => update({ effort: e.target.value as Effort })}
                >
                  {EFFORTS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-muted">Higher effort thinks longer: better for hard material, slower.</span>
              </label>
            </div>
          </details>

          {error && <ErrorText>{error}</ErrorText>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-zinc-50 px-5 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/60">
          <span className="text-sm text-muted">
            {notConnected ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4" /> Claude isn&apos;t connected.{" "}
                <Link href="/setup" className="font-medium underline">
                  Set it up
                </Link>
              </span>
            ) : (
              <>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{total} questions</span>
                {" · "}
                {prefs.difficulty === "mixed" ? "mixed difficulty" : prefs.difficulty}
                {" · "}
                {modelLabel || "no model"}
                {mode === "visual" ? " · visual" : ""}
              </>
            )}
          </span>
          <Button
            type="submit"
            disabled={busy || total === 0 || !prefs.model || selected.length === 0 || visualTooBig}
          >
            {busy ? <Spinner /> : <Sparkles className="size-4" />}
            Generate
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  hint,
  action,
  children,
}: {
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <legend className="text-sm font-medium">
          {label}
          {hint && <span className="ml-2 font-normal text-muted">{hint}</span>}
        </legend>
        {action}
      </div>
      {children}
    </fieldset>
  );
}

function StepButton({
  children,
  label,
  ...props
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-8 place-items-center rounded-md text-muted transition-colors hover:bg-zinc-200 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-30 pointer-coarse:size-10 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
      {...props}
    >
      {children}
    </button>
  );
}

function OptionCard({
  active,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-lg border p-3 text-left transition-colors pointer-coarse:p-3.5",
        active
          ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500 dark:bg-brand-950/40"
          : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <div className="mt-1 text-xs text-muted">{text}</div>
    </button>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="mt-2 flex gap-2 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
