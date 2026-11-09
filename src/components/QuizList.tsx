import Link from "next/link";
import { AlertCircle, ArrowRight, Layers, ListChecks } from "lucide-react";
import { formatRelative } from "@/lib/format";
import type { QuizRecord } from "@/lib/types";
import { Badge, EmptyState, cx } from "./ui";

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
    <ul className="stagger divide-y divide-line overflow-hidden rounded-xl border border-line">
      {quizzes.map((q, i) => {
        const s = stats[q.id];
        const sources =
          q.documents.length === 1
            ? q.documents[0].name
            : q.documents.length > 1
              ? `${q.documents.length} materials`
              : "Source deleted";
        return (
          <li key={q.id} style={{ "--i": i } as React.CSSProperties}>
            <Link
              href={`/quizzes/${q.id}`}
              className="group flex items-center gap-4 bg-surface px-4 py-3.5 transition-colors duration-150 hover:bg-sunken sm:gap-5"
            >
              <BestScore status={q.status} best={s?.best} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-medium">{q.title}</span>
                  {q.documents.length > 1 && (
                    <Badge className="hidden shrink-0 sm:inline-flex">
                      <Layers className="size-3" /> Combined
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[13px] text-subtle">
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
                <Badge>
                  <span className="relative flex size-1.5" aria-hidden>
                    <span className="absolute inset-0 animate-ping rounded-full bg-foreground" />
                    <span className="relative size-1.5 rounded-full bg-foreground" />
                  </span>
                  Generating
                </Badge>
              )}
              {q.status === "error" && (
                <Badge tone="red">
                  <AlertCircle className="size-3" /> Failed
                </Badge>
              )}
              <ArrowRight
                className="size-4 shrink-0 -translate-x-1 text-subtle opacity-0 transition-[opacity,transform,color] duration-200 group-hover:translate-x-0 group-hover:text-foreground group-hover:opacity-100"
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Best score as a number over a hairline bar; a dash until the first attempt. */
function BestScore({ status, best }: { status: QuizRecord["status"]; best?: number }) {
  const pct = best !== undefined ? Math.round(best * 100) : null;
  return (
    <span
      className="w-11 shrink-0"
      title={pct !== null ? `Best score ${pct}%` : "Not attempted yet"}
    >
      <span
        className={cx(
          "block font-mono text-sm font-medium tabular-nums",
          pct === null ? "text-subtle" : "text-foreground",
        )}
      >
        {status !== "ready" ? "··" : pct !== null ? `${pct}%` : "–"}
      </span>
      <span aria-hidden className="mt-1.5 block h-0.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {pct !== null && (
          <span className="animate-grow-x block h-full bg-foreground" style={{ width: `${Math.max(2, pct)}%` }} />
        )}
      </span>
    </span>
  );
}
