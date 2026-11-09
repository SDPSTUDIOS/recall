import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { AlertTriangle, ChevronRight, FileText, History } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { EditableTitle } from "@/components/EditableTitle";
import { GeneratingView } from "@/components/GeneratingView";
import { QuizRunner } from "@/components/QuizRunner";
import { RetryButton } from "@/components/RetryButton";
import { Badge, Card, PageHeader, PageLoading, cx, scoreTone } from "@/components/ui";
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
    <div className="space-y-8">
      <PageHeader
        back={{ href: backHref, label: single ? single.name : "Library" }}
        eyebrow={quiz.documents.length > 1 ? "Combined question set" : "Question set"}
        title={
          <EditableTitle
            value={quiz.title}
            url={`/api/quizzes/${quiz.id}`}
            field="title"
            className="font-display text-3xl leading-[1.1] sm:text-4xl"
          />
        }
        meta={
          <div className="space-y-2.5">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted">
              {quiz.status === "ready" && (
                <>
                  <Badge>{quiz.questions.length} questions</Badge>
                  <Badge>{totalMarks} marks</Badge>
                </>
              )}
              <Badge className="font-mono">{quiz.modelUsed ?? quiz.model}</Badge>
              {quiz.config.difficulty !== "mixed" && <Badge className="capitalize">{quiz.config.difficulty}</Badge>}
              {quiz.config.pageFrom > 0 && (
                <Badge>
                  pages {quiz.config.pageFrom}–{quiz.config.pageTo}
                </Badge>
              )}
              {quiz.durationMs && (
                <span className="font-mono text-xs text-subtle">generated in {formatDuration(quiz.durationMs)}</span>
              )}
            </p>
            {quiz.documents.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                <span className="mr-0.5">From</span>
                {quiz.documents.map((d) => (
                  <Link
                    key={d.id}
                    href={`/documents/${d.id}`}
                    className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-muted transition-colors hover:border-foreground hover:text-foreground"
                  >
                    <FileText className="size-3" aria-hidden />
                    {d.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        }
        actions={
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
        }
      />

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
        <Card className="space-y-5 border-red-500/25 p-6">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-400">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-xl">Generation failed</div>
              <p className="mt-1.5 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-muted">
                {quiz.error}
              </p>
              <p className="mt-3 text-xs text-muted">
                If it keeps failing, try another model or Text mode, or check{" "}
                <Link href="/setup" className="font-medium underline underline-offset-2">
                  setup
                </Link>
                .
              </p>
            </div>
          </div>
          <RetryButton url={`/api/quizzes/${quiz.id}/retry`} />
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
  const chronological = [...attempts].reverse().slice(-16);
  return (
    <details className="surface group animate-fade-up overflow-hidden rounded-xl">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 place-items-center rounded-lg bg-zinc-100 text-subtle">
          <History className="size-4" />
        </span>
        <span className="text-sm font-medium">
          {attempts.length} past {attempts.length === 1 ? "attempt" : "attempts"}
        </span>
        <Badge tone={scoreTone(best / 100)}>Best {best}%</Badge>
        {/* Score trend, oldest to newest */}
        <span className="ml-auto hidden h-7 items-end gap-[3px] sm:flex" aria-hidden>
          {chronological.map((a) => {
            const p = pct(a.score, a.maxScore);
            return (
              <span
                key={a.id}
                className={cx(
                  "w-1.5 rounded-full opacity-80",
                  p >= 80 ? "bg-emerald-500" : p >= 50 ? "bg-amber-500" : "bg-red-500",
                )}
                style={{ height: `${Math.max(14, p)}%` }}
              />
            );
          })}
        </span>
        <ChevronRight className="ml-auto size-4 text-subtle transition-transform duration-300 group-open:rotate-90 sm:ml-2" />
      </summary>
      <div className="divide-y divide-line border-t border-line">
        {attempts.map((a) => {
          const p = pct(a.score, a.maxScore);
          return (
            <Link
              key={a.id}
              href={`/attempts/${a.id}`}
              className="group/row flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-sunken"
            >
              <span>
                {formatDate(a.createdAt)}{" "}
                <span className="font-mono text-xs text-subtle">· {formatRelative(a.createdAt)}</span>
              </span>
              <span className="flex items-center gap-2">
                <Badge tone={scoreTone(p / 100)}>{p}%</Badge>
                <ChevronRight className="size-4 text-subtle transition-transform group-hover/row:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </details>
  );
}
