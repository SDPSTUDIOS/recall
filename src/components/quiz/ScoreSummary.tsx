"use client";

import { Check, CircleDashed, Minus, RotateCcw, X } from "lucide-react";
import type { ReactNode } from "react";
import { pct } from "@/lib/format";
import { QUESTION_TYPES, type AttemptRecord, type Question } from "@/lib/types";
import { Button, Meter } from "../ui";
import { fmt } from "./QuestionCard";

const verdict = (p: number) =>
  p >= 90 ? "Excellent" : p >= 75 ? "Great work" : p >= 60 ? "Good effort" : p >= 40 ? "Getting there" : "Keep practising";

export function ScoreSummary({
  attempt,
  questions,
  onRetake,
}: {
  attempt: AttemptRecord;
  questions: Question[];
  onRetake: () => void;
}) {
  const percent = pct(attempt.score, attempt.maxScore);
  const byId = new Map(questions.map((q) => [q.id, q]));

  const byType = QUESTION_TYPES.map(({ type, label }) => {
    const rs = attempt.results.filter((r) => byId.get(r.questionId)?.type === type);
    return {
      label,
      count: rs.length,
      score: rs.reduce((n, r) => n + r.score, 0),
      max: rs.reduce((n, r) => n + r.maxScore, 0),
    };
  }).filter((t) => t.count > 0);

  // Topics, weakest first, so the student knows what to revise.
  const topicMap = new Map<string, { label: string; score: number; max: number }>();
  for (const r of attempt.results) {
    const topic = byId.get(r.questionId)?.topic?.trim();
    if (!topic) continue;
    const key = topic.toLowerCase();
    const t = topicMap.get(key) ?? { label: topic, score: 0, max: 0 };
    t.score += r.score;
    t.max += r.maxScore;
    topicMap.set(key, t);
  }
  const weakTopics = [...topicMap.values()]
    .filter((t) => t.max > 0 && t.score < t.max)
    .sort((a, b) => a.score / a.max - b.score / b.max)
    .slice(0, 5);

  const counts = {
    correct: attempt.results.filter((r) => r.status === "correct").length,
    partial: attempt.results.filter((r) => r.status === "partial").length,
    wrong: attempt.results.filter((r) => r.status === "incorrect" || r.status === "ungraded").length,
    skipped: attempt.results.filter((r) => r.status === "unanswered").length,
  };

  return (
    <section aria-label="Your result" className="animate-fade-up overflow-hidden rounded-xl border border-line">
      <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-12">
        <div>
          <div className="font-mono text-xs text-subtle">Your result</div>
          <div className="font-display mt-2 text-7xl leading-none tabular-nums tracking-[-0.05em] sm:text-8xl">
            {percent}
            <span className="text-4xl text-subtle sm:text-5xl">%</span>
          </div>
          <div className="mt-3 text-lg font-medium">{verdict(percent)}</div>
          <div className="mt-0.5 font-mono text-xs tabular-nums text-subtle">
            {fmt(attempt.score)} of {fmt(attempt.maxScore)} marks
          </div>
        </div>

        <div className="min-w-0 space-y-6 md:pt-6">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            <Count icon={<Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />} n={counts.correct} label="Correct" />
            <Count icon={<Minus className="size-3.5 text-amber-600 dark:text-amber-400" strokeWidth={2.5} />} n={counts.partial} label="Partly" />
            <Count icon={<X className="size-3.5 text-red-600 dark:text-red-400" strokeWidth={2.5} />} n={counts.wrong} label="Incorrect" />
            <Count icon={<CircleDashed className="size-3.5 text-subtle" />} n={counts.skipped} label="Skipped" />
          </dl>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {byType.map((t) => (
              <Bar key={t.label} label={t.label} score={t.score} max={t.max} />
            ))}
          </div>
        </div>
      </div>

      {weakTopics.length > 0 && (
        <div className="border-t border-line px-6 py-6 sm:px-8">
          <h3 className="mb-4 text-sm font-semibold">Topics to review</h3>
          <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {weakTopics.map((t) => (
              <Bar key={t.label} label={t.label} score={t.score} max={t.max} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken px-6 py-4 sm:px-8">
        <p className="text-[13px] text-muted">Review each answer below, or ask Claude about any question.</p>
        <Button onClick={onRetake}>
          <RotateCcw className="size-4" /> Retake
        </Button>
      </div>
    </section>
  );
}

function Count({ icon, n, label }: { icon: ReactNode; n: number; label: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-subtle">
        <span aria-hidden>{icon}</span>
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xl font-medium tabular-nums">{n}</dd>
    </div>
  );
}

function Bar({ label, score, max }: { label: string; score: number; max: number }) {
  const p = pct(score, max);
  return (
    <div className="space-y-2">
      <div className="flex justify-between gap-3 text-[13px]">
        <span className="truncate">{label}</span>
        <span className="shrink-0 font-mono tabular-nums text-subtle">
          {fmt(score)}/{fmt(max)}
        </span>
      </div>
      <Meter value={Math.max(p, 2) / 100} />
    </div>
  );
}
