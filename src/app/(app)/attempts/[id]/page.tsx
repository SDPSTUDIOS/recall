import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { QuizRunner } from "@/components/QuizRunner";
import { PageHeader, PageLoading } from "@/components/ui";
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
    <div className="space-y-8">
      <PageHeader
        back={{ href: `/quizzes/${quiz.id}`, label: quiz.title }}
        eyebrow="Past attempt"
        title={`Attempt from ${formatDate(attempt.createdAt)}`}
      />
      <QuizRunner
        quizId={quiz.id}
        questions={quiz.questions}
        initialAttempt={attempt}
        initialChats={listTutorChats(quiz.id)}
      />
    </div>
  );
}
