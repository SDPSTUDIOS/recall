"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Check, ChevronDown, Eye, FileText, Minus, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
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
  /** The unit it belongs to, for grouping in the picker. */
  unitId?: string;
  unitName?: string;
}

export function GenerateForm({
  documents,
  pickable = false,
  initialUnitId,
}: {
  documents: DocumentOption[];
  /** Show a document picker, grouped by unit. */
  pickable?: boolean;
  /** Start with this unit's documents selected (otherwise all of them). */
  initialUnitId?: string;
}) {
  const router = useRouter();
  const { status } = useClaudeStatus();
  const [selectedIds, setSelectedIds] = useState(() =>
    documents.filter((d) => !initialUnitId || d.unitId === initialUnitId).map((d) => d.id),
  );
  const groups = groupByUnit(documents);
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
    <form onSubmit={submit} className="animate-fade-up">
      <Card className="divide-y divide-line overflow-hidden">
        {pickable && (
          <Field
            n={1}
            label="Materials"
            hint={`${selected.length} of ${documents.length} selected · ${selectedPages} pages`}
            action={
              <button
                type="button"
                className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                onClick={() =>
                  setSelectedIds(selected.length === documents.length ? [] : documents.map((d) => d.id))
                }
              >
                {selected.length === documents.length ? "Clear all" : "Select all"}
              </button>
            }
          >
            <div className="max-h-[26rem] space-y-5 overflow-y-auto p-0.5">
              {groups.map((g) => {
                const ids = g.documents.map((d) => d.id);
                const all = ids.every((id) => selectedIds.includes(id));
                return (
                  <div key={g.key} role="group" aria-label={g.name}>
                    {groups.length > 1 && (
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-[13px] font-medium">{g.name}</span>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
                          onClick={() =>
                            setSelectedIds((cur) =>
                              all ? cur.filter((id) => !ids.includes(id)) : [...new Set([...cur, ...ids])],
                            )
                          }
                        >
                          {all ? "Clear unit" : "Select unit"}
                        </button>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
              {g.documents.map((d) => {
                const on = selectedIds.includes(d.id);
                return (
                  <label
                    key={d.id}
                    className={cx(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-[background-color,border-color] duration-150 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-foreground",
                      on ? "border-line-strong bg-sunken" : "border-line hover:border-line-strong hover:bg-sunken",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={(e) =>
                        setSelectedIds((ids) =>
                          e.target.checked ? [...ids, d.id] : ids.filter((id) => id !== d.id),
                        )
                      }
                    />
                    <span
                      aria-hidden
                      className={cx(
                        "grid size-5 shrink-0 place-items-center rounded-md transition-colors",
                        on ? "bg-foreground text-background" : "border border-line-strong",
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                    </span>
                    <FileText className="size-4 shrink-0 text-subtle" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{d.name}</span>
                    {d.lowText && <Badge tone="amber">Scanned</Badge>}
                    <span className="shrink-0 font-mono text-xs tabular-nums text-subtle">{d.pageCount}p</span>
                  </label>
                );
              })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Field>
        )}

        <Field n={pickable ? 2 : 1} label="Questions" hint={`${total} in total`}>
          <div className="mb-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {PRESETS.map((p) => {
              const on = activePreset === p;
              return (
                <button
                  key={p.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ counts: p.counts })}
                  className={cx(
                    "rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color,color] duration-150",
                    on ? "border-foreground bg-foreground text-background" : "border-line hover:border-line-strong hover:bg-sunken",
                  )}
                >
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className={cx("mt-0.5 text-xs", on ? "opacity-70" : "text-muted")}>{p.hint}</div>
                </button>
              );
            })}
          </div>

          {/* The mix at a glance. */}
          <div className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
            {QUESTION_TYPES.map((t, i) =>
              prefs.counts[t.type] > 0 ? (
                <span
                  key={t.type}
                  className={cx("h-full transition-[flex-grow] duration-500 ease-(--ease-out-expo)", MIX_COLORS[i])}
                  style={{ flexGrow: prefs.counts[t.type] }}
                />
              ) : null,
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {QUESTION_TYPES.map((t, i) => {
              const n = prefs.counts[t.type];
              return (
                <div
                  key={t.type}
                  className={cx(
                    "flex items-center gap-3 rounded-lg p-3 ring-1 ring-inset transition-[background-color,box-shadow] duration-200",
                    n > 0 ? "bg-sunken ring-line-strong " : "ring-line",
                  )}
                >
                  <span
                    aria-hidden
                    className={cx("size-2.5 shrink-0 rounded-full transition-opacity", MIX_COLORS[i], n === 0 && "opacity-25")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className={cx("text-sm font-medium", n === 0 && "text-muted")}>{t.label}</div>
                    <div className="text-xs text-muted">{t.description}</div>
                  </div>
                  <div className="flex items-center rounded-lg bg-zinc-100 p-0.5 ring-1 ring-inset ring-line">
                    <StepButton onClick={() => setCount(t.type, n - 1)} disabled={n === 0} label={`Fewer ${t.label}`}>
                      <Minus className="size-3.5" />
                    </StepButton>
                    <input
                      aria-label={`${t.label} count`}
                      inputMode="numeric"
                      value={n}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => setCount(t.type, Number(e.target.value.replace(/\D/g, "")) || 0)}
                      className="w-9 bg-transparent py-1 text-center font-mono text-sm font-medium tabular-nums outline-none focus:underline"
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

        <Field n={pickable ? 3 : 2} label="Difficulty">
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

        <Field n={pickable ? 4 : 3} label="Claude model">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
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
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="size-4 rounded accent-current"
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
                className={cx(inputClass, "max-w-64 py-1.5 font-mono")}
                placeholder="e.g. claude-opus-5-5"
                value={prefs.model}
                onChange={(e) => update({ model: e.target.value.trim() })}
                required
                autoFocus
              />
            )}
          </div>
        </Field>

        <Field n={pickable ? 5 : 4} label="How Claude reads">
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

        <details className="group">
          <summary className="flex cursor-pointer select-none list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium transition-colors hover:bg-zinc-100 sm:px-6 dark:hover:bg-zinc-900 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-3">
              <SlidersHorizontal className="size-4 text-subtle" aria-hidden />
              More options
            </span>
            <span className="flex items-center gap-2 text-xs font-normal text-muted">
              {single ? "Pages, focus, effort, title" : "Focus, effort, title"}
              <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" />
            </span>
          </summary>
          <div className="grid gap-4 px-5 pb-6 pt-1 sm:grid-cols-2 sm:px-6">
            {single && (
              <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">From page</span>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    placeholder="1"
                    value={pageFrom}
                    onChange={(e) => setPageFrom(e.target.value.replace(/\D/g, ""))}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">To page</span>
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
              <span className="text-sm font-medium">Focus topics</span>
              <textarea
                className={inputClass}
                rows={2}
                placeholder="e.g. normalisation, ER diagrams, transaction isolation"
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Title</span>
              <input
                className={inputClass}
                placeholder="Named automatically"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Effort</span>
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

        {error && (
          <div className="px-5 py-4 sm:px-6">
            <ErrorText>{error}</ErrorText>
          </div>
        )}
      </Card>

      {/* The summary and Generate button stay in reach while scrolling the form. */}
      <div className="sticky bottom-0 z-10 -mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-background/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <span className="min-w-0 text-sm text-muted">
          {notConnected ? (
            <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-4" /> Claude isn&apos;t connected.{" "}
              <Link href="/setup" className="font-medium underline">
                Set it up
              </Link>
            </span>
          ) : (
            <>
              <span className="font-mono font-semibold tabular-nums text-foreground">{total}</span>{" "}
              questions
              <span className="hidden sm:inline">
                {" · "}
                {prefs.difficulty === "mixed" ? "mixed difficulty" : prefs.difficulty}
                {" · "}
                {modelLabel || "no model"}
                {mode === "visual" ? " · visual" : ""}
              </span>
            </>
          )}
        </span>
        <Button
          type="submit"
          className="px-5"
          disabled={busy || total === 0 || !prefs.model || selected.length === 0 || visualTooBig}
        >
          {busy ? <Spinner /> : <Sparkles className="size-4" />}
          Generate
        </Button>
      </div>
    </form>
  );
}

/** Documents in their unit groups, keeping the order they were given in. */
function groupByUnit(documents: DocumentOption[]) {
  const groups: { key: string; name: string; documents: DocumentOption[] }[] = [];
  for (const d of documents) {
    const key = d.unitId ?? "";
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, name: d.unitName ?? "Materials", documents: [] }));
    g.documents.push(d);
  }
  return groups;
}

/** One shade or pattern per question type, in QUESTION_TYPES order, for the mix bar. Greys only. */
const MIX_COLORS = [
  "bg-foreground",
  "bg-zinc-500",
  "bg-zinc-300 dark:bg-zinc-700",
  "bg-[repeating-linear-gradient(135deg,var(--foreground)_0_1.5px,transparent_1.5px_4px)]",
  "bg-[repeating-linear-gradient(135deg,var(--color-zinc-500)_0_1.5px,transparent_1.5px_4px)]",
];

function Field({
  n,
  label,
  hint,
  action,
  children,
}: {
  n: number;
  label: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-4 px-5 py-6 sm:px-6 lg:grid-cols-[10rem_1fr] lg:gap-8">
      <legend className="sr-only">{label}</legend>
      <div className="flex items-start justify-between gap-3 lg:flex-col lg:justify-start lg:gap-2" aria-hidden>
        <div>
          <span className="font-mono text-xs tabular-nums text-subtle">
            {String(n).padStart(2, "0")}
          </span>
          <span className="mt-0.5 block text-[15px] font-semibold tracking-tight">{label}</span>
          {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
        </div>
      </div>
      <div className="min-w-0">
        {action && <div className="-mt-1 mb-2 flex justify-end lg:-mt-0">{action}</div>}
        {children}
      </div>
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
      className="grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-zinc-100 hover:text-foreground disabled:pointer-events-none disabled:opacity-30 pointer-coarse:size-10 dark:hover:bg-zinc-800"
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
        "relative rounded-lg border p-3.5 text-left transition-[background-color,border-color] duration-150",
        active ? "border-foreground bg-sunken" : "border-line hover:border-line-strong hover:bg-sunken",
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon && <span className={cx(active ? "text-foreground" : "text-subtle")}>{icon}</span>}
        <span>{title}</span>
        <span
          aria-hidden
          className={cx(
            "ml-auto grid size-4 shrink-0 place-items-center rounded-full transition-transform duration-200",
            active ? "bg-foreground" : "scale-90 border border-line-strong",
          )}
        >
          {active && <span className="size-1.5 rounded-full bg-background" />}
        </span>
      </div>
      <div className="mt-1 text-xs leading-relaxed text-muted">{text}</div>
    </button>
  );
}

function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex gap-2 rounded-md border border-amber-600/30 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-400/25 dark:text-amber-300">
      <AlertTriangle className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
