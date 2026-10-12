"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Eye,
  Flag,
  LayoutList,
  Minus,
  Send,
  Square,
  X,
} from "lucide-react";
import { gradeLocally, isAnswered } from "@/lib/grade";
import {
  QUESTION_TYPES,
  isWritten,
  type Answer,
  type Answers,
  type AttemptRecord,
  type Question,
  type QuestionResult,
} from "@/lib/types";
import { useConfirm } from "./Dialog";
import { LETTERS, QuestionCard } from "./quiz/QuestionCard";
import { ScoreSummary } from "./quiz/ScoreSummary";
import { Button, ErrorText, Kbd, Spinner, ToggleGroup, cx } from "./ui";

type Mode = "exam" | "practice";
type Layout = "focus" | "list";
type ReviewFilter = "all" | "review" | "correct";

const LAYOUT_KEY = "exam-helper:quiz-layout";
const draftKey = (quizId: string) => `exam-helper:draft:${quizId}`;

interface Draft {
  answers: Answers;
  flagged: string[];
  current: number;
  /** Time spent so far, so the timer resumes rather than counting time away. */
  elapsedMs: number;
}

export function QuizRunner({
  quizId,
  questions,
  initialAttempt,
}: {
  quizId: string;
  questions: Question[];
  initialAttempt?: AttemptRecord;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("exam");
  const [layout, setLayout] = useState<Layout>("focus");
  const [answers, setAnswers] = useState<Answers>(initialAttempt?.answers ?? {});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [checked, setChecked] = useState<Record<string, QuestionResult | "revealed">>({});
  const [attempt, setAttempt] = useState<AttemptRecord | null>(initialAttempt ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [confirm, confirmDialog] = useConfirm();

  // Restore the layout choice and any unsubmitted answers (per-browser conveniences).
  useEffect(() => {
    try {
      const l = localStorage.getItem(LAYOUT_KEY);
      // Read after mount so the server render matches.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (l === "focus" || l === "list") setLayout(l);
      if (!initialAttempt) {
        const d: Draft | null = JSON.parse(localStorage.getItem(draftKey(quizId)) ?? "null");
        const ids = new Set(questions.map((q) => q.id));
        if (d && Object.keys(d.answers ?? {}).some((id) => ids.has(id))) {
          setAnswers(d.answers);
          setFlagged((d.flagged ?? []).filter((id) => ids.has(id)));
          setCurrent(Math.min(Math.max(0, d.current ?? 0), questions.length - 1));
          setStartedAt(Date.now() - (d.elapsedMs ?? 0));
          setRestored(true);
        } else {
          setStartedAt(Date.now());
        }
      }
    } catch {
      setStartedAt(Date.now());
    }
    setHydrated(true);
  }, [quizId, questions, initialAttempt]);

  // Save the draft as the student works, and periodically for the timer.
  useEffect(() => {
    if (!hydrated || attempt || startedAt === null) return;
    const save = () => {
      try {
        const draft: Draft = { answers, flagged, current, elapsedMs: Date.now() - startedAt };
        localStorage.setItem(draftKey(quizId), JSON.stringify(draft));
      } catch {
        /* ignore */
      }
    };
    save();
    const id = setInterval(save, 10_000);
    window.addEventListener("pagehide", save);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", save);
    };
  }, [hydrated, attempt, answers, flagged, current, startedAt, quizId]);

  const chooseLayout = (l: Layout) => {
    setLayout(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* ignore */
    }
  };

  const resultById = useMemo(
    () => new Map(attempt?.results.map((r) => [r.questionId, r]) ?? []),
    [attempt],
  );
  const answered = (q: Question) => isAnswered(q, answers[q.id]);
  const answeredCount = questions.filter(answered).length;
  const hasWritten = questions.some((q) => isWritten(q.type) && answered(q));
  const locked = !!attempt || submitting;
  const numbers = new Map(questions.map((q, i) => [q.id, i + 1]));

  const setAnswer = (id: string, a: Answer) => {
    setAnswers((prev) => ({ ...prev, [id]: a }));
    setChecked((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleFlag = (id: string) =>
    setFlagged((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));

  const check = (q: Question) =>
    setChecked((prev) => ({ ...prev, [q.id]: gradeLocally(q, answers[q.id]) ?? "revealed" }));

  const practiceResult = (q: Question) => {
    const c = checked[q.id];
    return c && c !== "revealed" ? c : undefined;
  };

  async function submit() {
    const unanswered = questions.length - answeredCount;
    if (unanswered > 0 || flagged.length > 0) {
      const ok = await confirm({
        title: "Submit for grading?",
        body: (
          <ul className="list-disc space-y-1 pl-5">
            {unanswered > 0 && (
              <li>
                {unanswered} {unanswered === 1 ? "question is" : "questions are"} unanswered and will score 0.
              </li>
            )}
            {flagged.length > 0 && (
              <li>
                {flagged.length} {flagged.length === 1 ? "question is" : "questions are"} marked for review.
              </li>
            )}
          </ul>
        ),
        confirmLabel: "Submit",
        cancelLabel: "Keep working",
      });
      if (!ok) return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Submission failed");
      setAttempt(json.attempt);
      setFilter("all");
      try {
        localStorage.removeItem(draftKey(quizId));
      } catch {
        /* ignore */
      }
      if (json.gradingError) setError(`Written answers could not be graded: ${json.gradingError}`);
      window.scrollTo({ top: 0, behavior: "smooth" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  function retake() {
    setAttempt(null);
    setAnswers({});
    setFlagged([]);
    setChecked({});
    setCurrent(0);
    setStartedAt(Date.now());
    setRestored(false);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const go = (i: number) => {
    setCurrent(Math.min(Math.max(0, i), questions.length - 1));
    if (layout === "list") {
      document.getElementById(`q-${questions[i]?.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Keyboard shortcuts for the focused question.
  useEffect(() => {
    if (attempt || layout !== "focus") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.closest("input:not([type=radio]):not([type=checkbox]), textarea, select, [contenteditable]")) return;
      if (document.querySelector("dialog[open]")) return;
      const q = questions[current];
      if (!q) return;

      if (e.key === "ArrowRight") go(current + 1);
      else if (e.key === "ArrowLeft") go(current - 1);
      else if (e.key.toLowerCase() === "m") toggleFlag(q.id);
      else if (e.key === "Enter" && mode === "practice" && !checked[q.id]) {
        if (isWritten(q.type) || answered(q)) check(q);
      } else if ((q.type === "mcq" || q.type === "single") && !locked) {
        const i = LETTERS.indexOf(e.key.toUpperCase());
        if (i < 0 || i >= q.options.length || e.key.length !== 1) return;
        const sel = answers[q.id]?.kind === "choice" ? (answers[q.id] as { selected: number[] }).selected : [];
        setAnswer(q.id, {
          kind: "choice",
          selected:
            q.type === "single" ? [i] : sel.includes(i) ? sel.filter((s) => s !== i) : [...sel, i].sort((a, b) => a - b),
        });
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // ---------- results ----------
  if (attempt) {
    const review = (q: Question) => resultById.get(q.id)?.status !== "correct";
    const visible = questions.filter((q) =>
      filter === "all" ? true : filter === "review" ? review(q) : !review(q),
    );
    const reviewCount = questions.filter(review).length;
    return (
      <div className="space-y-6">
        <ScoreSummary attempt={attempt} questions={questions} onRetake={retake} />
        {error && <ErrorText>{error}</ErrorText>}

        <div className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-[var(--background)]/90 px-4 py-2.5 backdrop-blur dark:border-zinc-800">
          <span className="mr-1 text-sm font-medium">Review</span>
          <ToggleGroup
            label="Filter questions"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: `All ${questions.length}` },
              { value: "review", label: `To review ${reviewCount}` },
              { value: "correct", label: `Correct ${questions.length - reviewCount}` },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {filter === "review" ? "Nothing to review. Every answer was correct." : "No questions here."}
          </p>
        ) : (
          <GroupedList
            questions={visible}
            render={(q) => (
              <QuestionCard
                key={q.id}
                number={numbers.get(q.id)!}
                question={q}
                answer={answers[q.id]}
                onChange={() => {}}
                disabled
                result={resultById.get(q.id)}
                reveal
              />
            )}
          />
        )}
      </div>
    );
  }

  // ---------- taking the quiz ----------
  const q = questions[current];
  const practiceFooter = (q: Question) =>
    mode === "practice" && !checked[q.id] ? (
      <Button variant="secondary" disabled={!isWritten(q.type) && !answered(q)} onClick={() => check(q)}>
        {isWritten(q.type) ? <Eye className="size-4" /> : <Check className="size-4" />}
        {isWritten(q.type) ? "Show model answer" : "Check answer"}
      </Button>
    ) : null;

  const card = (q: Question, focus: boolean) => (
    <QuestionCard
      key={q.id}
      number={numbers.get(q.id)!}
      total={focus ? questions.length : undefined}
      question={q}
      answer={answers[q.id]}
      onChange={(a) => setAnswer(q.id, a)}
      disabled={locked}
      result={practiceResult(q)}
      reveal={!!checked[q.id]}
      flagged={flagged.includes(q.id)}
      onToggleFlag={() => toggleFlag(q.id)}
      showType={focus}
      footer={practiceFooter(q)}
    />
  );

  return (
    <div className="space-y-5">
      {confirmDialog}

      {/* Toolbar */}
      <div className="sticky top-14 z-10 -mx-4 border-b border-zinc-200 bg-[var(--background)]/90 px-4 py-2.5 backdrop-blur dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <ToggleGroup
            label="Mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "exam", label: "Exam", title: "Answer everything, then submit for grading" },
              { value: "practice", label: "Practice", title: "Check each answer as you go" },
            ]}
          />
          <ToggleGroup
            label="Layout"
            size="sm"
            value={layout}
            onChange={chooseLayout}
            options={[
              { value: "focus", label: <Square className="size-3.5" />, aria: "One question at a time" },
              { value: "list", label: <LayoutList className="size-3.5" />, aria: "All questions on one page" },
            ]}
          />
          <span className="text-sm tabular-nums text-muted">
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{answeredCount}</span>/{questions.length} answered
          </span>
          <Timer startedAt={startedAt} />
          <Button onClick={submit} disabled={submitting} className="ml-auto">
            {submitting ? <Spinner /> : <Send className="size-4" />}
            {submitting ? (hasWritten ? "Claude is grading…" : "Grading…") : "Submit"}
          </Button>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={answeredCount}
            className="h-full origin-left rounded-full bg-brand-600 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${answeredCount / Math.max(1, questions.length)})` }}
          />
        </div>
      </div>

      {restored && answeredCount > 0 && (
        <div className="animate-fade-up flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/40 dark:text-brand-300">
          <span>Welcome back. Your answers from last time were restored.</span>
          <button
            type="button"
            className="font-medium underline-offset-2 hover:underline"
            onClick={async () => {
              if (await confirm({ title: "Start over?", body: "Your saved answers for this set will be cleared.", confirmLabel: "Start over", variant: "danger-solid" })) {
                retake();
              }
            }}
          >
            Start over
          </button>
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      {layout === "focus" && q ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_15rem] lg:items-start">
          <div className="min-w-0 space-y-4">
            <div key={q.id} className="animate-fade-up">
              {card(q, true)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => go(current - 1)} disabled={current === 0}>
                <ArrowLeft className="size-4" /> Previous
              </Button>
              {current < questions.length - 1 ? (
                <Button onClick={() => go(current + 1)}>
                  Next <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button onClick={submit} disabled={submitting}>
                  <Send className="size-4" /> Finish and submit
                </Button>
              )}
            </div>
            <p className="hidden flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted sm:flex">
              <span className="inline-flex items-center gap-1"><Kbd>←</Kbd><Kbd>→</Kbd> move</span>
              <span className="inline-flex items-center gap-1"><Kbd>A</Kbd>–<Kbd>F</Kbd> choose option</span>
              <span className="inline-flex items-center gap-1"><Kbd>M</Kbd> mark for review</span>
              {mode === "practice" && <span className="inline-flex items-center gap-1"><Kbd>Enter</Kbd> check</span>}
            </p>
          </div>
          <Navigator
            questions={questions}
            current={current}
            onSelect={go}
            answered={answered}
            flagged={flagged}
            resultOf={practiceResult}
          />
        </div>
      ) : (
        <>
          <GroupedList questions={questions} render={(q) => card(q, false)} />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? <Spinner /> : <Send className="size-4" />}
              {submitting ? (hasWritten ? "Claude is grading…" : "Grading…") : "Submit for grading"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function GroupedList({
  questions,
  render,
}: {
  questions: Question[];
  render: (q: Question) => React.ReactNode;
}) {
  return (
    <>
      {QUESTION_TYPES.map(({ type, label }) => {
        const group = questions.filter((q) => q.type === type);
        if (group.length === 0) return null;
        return (
          <section key={type} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {label} <span className="font-normal normal-case">({group.length})</span>
            </h2>
            {group.map(render)}
          </section>
        );
      })}
    </>
  );
}

function Navigator({
  questions,
  current,
  onSelect,
  answered,
  flagged,
  resultOf,
}: {
  questions: Question[];
  current: number;
  onSelect: (i: number) => void;
  answered: (q: Question) => boolean;
  flagged: string[];
  resultOf: (q: Question) => QuestionResult | undefined;
}) {
  return (
    <nav aria-label="Questions" className="lg:sticky lg:top-36">
      <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-2 text-xs font-medium text-muted">Questions</div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5">
          {questions.map((q, i) => {
            const r = resultOf(q);
            const isFlagged = flagged.includes(q.id);
            // An icon as well as the colour, so results don't rely on colour alone.
            const StatusIcon = !r ? null : r.status === "correct" ? Check : r.status === "partial" ? Minus : X;
            const statusText = !r
              ? ""
              : r.status === "correct"
                ? ", correct"
                : r.status === "partial"
                  ? ", partly correct"
                  : ", incorrect";
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(i)}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Question ${i + 1}${answered(q) ? ", answered" : ""}${statusText}${isFlagged ? ", marked for review" : ""}`}
                className={cx(
                  "relative grid h-9 place-items-center rounded-md border text-xs font-medium tabular-nums transition-colors pointer-coarse:h-11",
                  r?.status === "correct"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : r?.status === "partial"
                      ? "border-amber-500 bg-amber-500 text-white"
                      : r
                        ? "border-red-500 bg-red-500 text-white"
                        : answered(q)
                          ? "border-brand-200 bg-brand-100 text-brand-800 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-200"
                          : "border-zinc-200 text-muted hover:border-zinc-400 dark:border-zinc-700",
                  i === current && "ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900",
                )}
              >
                {i + 1}
                {StatusIcon && (
                  <StatusIcon
                    className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-white p-0.5 text-zinc-800 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-700"
                    strokeWidth={3}
                    aria-hidden
                  />
                )}
                {isFlagged && (
                  <Flag className="absolute -right-1 -top-1 size-3 fill-amber-500 text-amber-500" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-sm bg-brand-200 dark:bg-brand-900" /> Answered
          </span>
          <span className="inline-flex items-center gap-1">
            <Flag className="size-2.5 fill-amber-500 text-amber-500" /> Marked
          </span>
          {questions.some((q) => resultOf(q)) && (
            <>
              <span className="inline-flex items-center gap-1">
                <Check className="size-3 text-emerald-600 dark:text-emerald-400" strokeWidth={3} /> Correct
              </span>
              <span className="inline-flex items-center gap-1">
                <X className="size-3 text-red-600 dark:text-red-400" strokeWidth={3} /> Incorrect
              </span>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function Timer({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (startedAt === null || now === null) return null;
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const text = `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(s % 60).padStart(2, "0")}`;
  return (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted" title="Time spent">
      <Clock className="size-3.5" /> {text}
    </span>
  );
}
