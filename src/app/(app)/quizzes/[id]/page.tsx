import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { AlertTriangle, ChevronRight, History } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { EditableTitle } from "@/components/EditableTitle";
import { GeneratingView } from "@/components/GeneratingView";
import { QuizRunner } from "@/components/QuizRunner";
import { RetryButton } from "@/components/RetryButton";
import { BackLink, Badge, Card, PageLoading, cx, scoreTone } from "@/components/ui";
import { formatDate, formatDuration, formatRelative, pct } from "@/lib/format";
import { getQuiz, listAttempts, listTutorChats } from "@/lib/repo";
import type { AttemptRecord } from "@/lib/types";

export default function QuizPage({ params }: PageProps<"/quizzes/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <QuizView params={params} />
    </Suspense>
  );
}

async function QuizView({ params }: { params: PageProps<"/quizzes/[id]">["params"] }) {
  const { id } = await params;
  await io();
  const quiz = getQuiz(id);
  if (!quiz) notFound();
  const attempts = quiz.status === "ready" ? listAttempts(id) : [];
  const totalMarks = quiz.questions.reduce((n, q) => n + q.marks, 0);
  const single = quiz.documents.length === 1 ? quiz.documents[0] : null;
  const backHref = single ? `/documents/${single.id}` : "/";

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={backHref}>{single ? single.name : "Library"}</BackLink>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <EditableTitle
              value={quiz.title}
              url={`/api/quizzes/${quiz.id}`}
              field="title"
              className="text-xl font-semibold tracking-tight sm:text-2xl"
            />
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {quiz.status === "ready" && (
                <span>
                  {quiz.questions.length} questions · {totalMarks} marks
                </span>
              )}
              <Badge tone="brand">{quiz.modelUsed ?? quiz.model}</Badge>
              {quiz.config.difficulty !== "mixed" && <Badge>{quiz.config.difficulty}</Badge>}
              {quiz.durationMs && <span>generated in {formatDuration(quiz.durationMs)}</span>}
              {quiz.config.pageFrom > 0 && (
                <span>
                  · pages {quiz.config.pageFrom}–{quiz.config.pageTo}
                </span>
              )}
            </p>
            {quiz.documents.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                From:
                {quiz.documents.map((d) => (
                  <Link
                    key={d.id}
                    href={`/documents/${d.id}`}
                    className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-700 hover:border-brand-300 hover:text-brand-700 dark:border-zinc-700 dark:text-zinc-300 dark:hover:text-brand-300"
                  >
                    {d.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <DeleteButton
            url={`/api/quizzes/${quiz.id}`}
            redirectTo={backHref}
            title={`Delete "${quiz.title}"?`}
            body={
              attempts.length > 0
                ? `Its ${attempts.length} ${attempts.length === 1 ? "attempt" : "attempts"} will be deleted too.`
                : undefined
            }
          />
        </div>
      </div>

      {quiz.status === "generating" && (
        <GeneratingView
          quizId={quiz.id}
          startedAt={quiz.startedAt}
          model={quiz.model}
          visual={quiz.config.mode === "visual"}
          count={Object.values(quiz.config.counts).reduce((a, b) => a + b, 0)}
        />
      )}

      {quiz.status === "error" && (
        <Card className="space-y-4 border-red-200 p-6 dark:border-red-900">
          <div className="flex gap-3">
            <AlertTriangle className="size-5 shrink-0 text-red-500" />
            <div className="min-w-0">
              <div className="font-medium">Generation failed</div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-600 dark:text-zinc-400">
                {quiz.error}
              </p>
              <p className="mt-2 text-xs text-muted">
                If it keeps failing, try another model or Text mode, or check{" "}
                <Link href="/setup" className="underline">
                  setup
                </Link>
                .
              </p>
            </div>
          </div>
          <RetryButton quizId={quiz.id} />
        </Card>
      )}

      {quiz.status === "ready" && (
        <>
          {attempts.length > 0 && <AttemptHistory attempts={attempts} />}
          <QuizRunner quizId={quiz.id} questions={quiz.questions} initialChats={listTutorChats(quiz.id)} />
        </>
      )}
    </div>
  );
}

function AttemptHistory({ attempts }: { attempts: AttemptRecord[] }) {
  const best = Math.max(...attempts.map((a) => pct(a.score, a.maxScore)));
  const chronological = [...attempts].reverse().slice(-12);
  return (
    <details className="group rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <History className="size-4 text-subtle" />
        <span className="text-sm font-medium">
          {attempts.length} past {attempts.length === 1 ? "attempt" : "attempts"}
        </span>
        <Badge tone={scoreTone(best / 100)}>Best {best}%</Badge>
        {/* Score trend, oldest to newest */}
        <span className="ml-auto flex h-6 items-end gap-0.5" aria-hidden>
          {chronological.map((a) => {
            const p = pct(a.score, a.maxScore);
            return (
              <span
                key={a.id}
                className={cx(
                  "w-1.5 rounded-sm",
                  p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-red-500",
                )}
                style={{ height: `${Math.max(12, p)}%` }}
              />
            );
          })}
        </span>
        <ChevronRight className="size-4 text-subtle transition-transform group-open:rotate-90" />
      </summary>
      <div className="divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {attempts.map((a) => {
          const p = pct(a.score, a.maxScore);
          return (
            <Link
              key={a.id}
              href={`/attempts/${a.id}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <span>
                {formatDate(a.createdAt)}{" "}
                <span className="text-subtle">· {formatRelative(a.createdAt)}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={scoreTone(p / 100)}>{p}%</Badge>
                <ChevronRight className="size-4 text-subtle" />
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}
