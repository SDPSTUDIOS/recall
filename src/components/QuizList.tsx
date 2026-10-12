import Link from "next/link";
import { AlertCircle, ChevronRight, Layers, Loader2, ListChecks } from "lucide-react";
import { formatRelative } from "@/lib/format";
import type { QuizRecord } from "@/lib/types";
import { Badge, Card, EmptyState, cx, scoreTone } from "./ui";

export function QuizList({
  quizzes,
  stats,
  showDocument = false,
  emptyText = "Generate a set above to start practising.",
}: {
  quizzes: QuizRecord[];
  stats: Record<string, { best: number; count: number }>;
  showDocument?: boolean;
  emptyText?: string;
}) {
  if (quizzes.length === 0) {
    return (
      <EmptyState icon={<ListChecks className="size-5" />} title="No question sets yet">
        {emptyText}
      </EmptyState>
    );
  }
  return (
    <Card className="divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800">
      {quizzes.map((q) => {
        const s = stats[q.id];
        const sources =
          q.documents.length === 1
            ? q.documents[0].name
            : q.documents.length > 1
              ? `${q.documents.length} materials`
              : "Source deleted";
        return (
          <Link
            key={q.id}
            href={`/quizzes/${q.id}`}
            className="group flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <ScoreRing status={q.status} best={s?.best} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{q.title}</span>
                {q.documents.length > 1 && (
                  <Badge tone="brand" className="hidden shrink-0 sm:inline-flex">
                    <Layers className="size-3" /> Combined
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {[
                  showDocument && sources,
                  q.status === "ready" && `${q.questions.length} questions`,
                  s?.count ? `${s.count} ${s.count === 1 ? "attempt" : "attempts"}` : q.status === "ready" && "Not attempted",
                  formatRelative(q.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {q.status === "generating" && (
              <Badge tone="brand">
                <Loader2 className="size-3 animate-spin" /> Generating
              </Badge>
            )}
            {q.status === "error" && (
              <Badge tone="red">
                <AlertCircle className="size-3" /> Failed
              </Badge>
            )}
            <ChevronRight className="size-4 shrink-0 text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-500" />
          </Link>
        );
      })}
    </Card>
  );
}

/** Best score as a small ring; dashed while there is no attempt yet. */
function ScoreRing({ status, best }: { status: QuizRecord["status"]; best?: number }) {
  const size = 40;
  const r = 16;
  const c = 2 * Math.PI * r;
  const tone = best !== undefined ? scoreTone(best) : null;
  const color = {
    green: "text-emerald-500",
    amber: "text-amber-500",
    red: "text-red-500",
  } as const;

  return (
    <span
      className="relative grid size-10 shrink-0 place-items-center"
      title={best !== undefined ? `Best score ${Math.round(best * 100)}%` : "Not attempted yet"}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={3}
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeDasharray={best === undefined ? "3 3" : undefined}
        />
        {best !== undefined && tone && tone !== "zinc" && tone !== "brand" && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={3}
            strokeLinecap="round"
            stroke="currentColor"
            className={cx(color[tone], "animate-ring-draw")}
            strokeDasharray={`${Math.max(0.02, best) * c} ${c}`}
          />
        )}
      </svg>
      <span
        className={cx(
          "absolute text-[10px] font-semibold tabular-nums",
          best === undefined ? "text-subtle" : "text-zinc-700 dark:text-zinc-200",
        )}
      >
        {status !== "ready" ? "" : best !== undefined ? Math.round(best * 100) : "–"}
      </span>
    </span>
  );
}
