import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { QuizRunner } from "@/components/QuizRunner";
import { BackLink, PageLoading } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getAttempt, getQuiz, listTutorChats } from "@/lib/repo";

export default function AttemptPage({ params }: PageProps<"/attempts/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AttemptView params={params} />
    </Suspense>
  );
}

async function AttemptView({ params }: { params: PageProps<"/attempts/[id]">["params"] }) {
  const { id } = await params;
  await io();
  const attempt = getAttempt(id);
  const quiz = attempt ? getQuiz(attempt.quizId) : null;
  if (!attempt || !quiz) notFound();

  return (
    <div className="space-y-6">
      <div>
        <BackLink href={`/quizzes/${quiz.id}`}>{quiz.title}</BackLink>
        <h1 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
          Attempt from {formatDate(attempt.createdAt)}
        </h1>
      </div>
      <QuizRunner
        quizId={quiz.id}
        questions={quiz.questions}
        initialAttempt={attempt}
        initialChats={listTutorChats(quiz.id)}
      />
    </div>
  );
}
