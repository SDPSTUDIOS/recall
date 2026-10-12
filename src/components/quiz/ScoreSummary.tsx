"use client";

import { RotateCcw } from "lucide-react";
import { pct } from "@/lib/format";
import { QUESTION_TYPES, type AttemptRecord, type Question } from "@/lib/types";
import { Button, Card, cx } from "../ui";
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

  const ring = percent >= 80 ? "text-emerald-500" : percent >= 50 ? "text-amber-500" : "text-red-500";
  const c = 2 * Math.PI * 52;

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="relative mx-auto grid size-32 shrink-0 place-items-center sm:mx-0">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-zinc-100 dark:stroke-zinc-800" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              stroke="currentColor"
              className={cx(ring, "animate-ring-draw")}
              strokeDasharray={`${(percent / 100) * c} ${c}`}
            />
          </svg>
          <div className="text-center">
            <div className="text-3xl font-bold tabular-nums tracking-tight">{percent}%</div>
            <div className="text-xs text-muted">
              {fmt(attempt.score)} / {fmt(attempt.maxScore)}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{verdict(percent)}</h2>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <Count color="bg-emerald-500" n={counts.correct} label="correct" />
              {counts.partial > 0 && <Count color="bg-amber-500" n={counts.partial} label="partly correct" />}
              <Count color="bg-red-500" n={counts.wrong} label="incorrect" />
              {counts.skipped > 0 && <Count color="bg-zinc-400" n={counts.skipped} label="skipped" />}
            </div>
          </div>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {byType.map((t) => (
              <Bar key={t.label} label={t.label} score={t.score} max={t.max} />
            ))}
          </div>
        </div>
      </div>

      {weakTopics.length > 0 && (
        <div className="border-t border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
          <h3 className="mb-2 text-sm font-semibold">Topics to review</h3>
          <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {weakTopics.map((t) => (
              <Bar key={t.label} label={t.label} score={t.score} max={t.max} />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/60">
        <Button onClick={onRetake}>
          <RotateCcw className="size-4" /> Retake
        </Button>
      </div>
    </Card>
  );
}

function Count({ color, n, label }: { color: string; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
      <span className={cx("size-2 rounded-full", color)} />
      <span className="font-medium tabular-nums text-zinc-800 dark:text-zinc-200">{n}</span> {label}
    </span>
  );
}

function Bar({ label, score, max }: { label: string; score: number; max: number }) {
  const p = pct(score, max);
  return (
    <div className="space-y-1">
      <div className="flex justify-between gap-3 text-xs">
        <span className="truncate text-zinc-600 dark:text-zinc-300">{label}</span>
        <span className="shrink-0 tabular-nums text-muted">
          {fmt(score)}/{fmt(max)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={cx("h-full rounded-full", p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-red-500")}
          style={{ width: `${Math.max(p, 2)}%` }}
        />
      </div>
    </div>
  );
}
