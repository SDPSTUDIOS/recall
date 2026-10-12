import { randomUUID } from "node:crypto";
import { gradeLocally } from "@/lib/grade";
import { gradeLongAnswers } from "@/lib/grade-ai";
import { getQuiz, insertAttempt } from "@/lib/repo";
import type { Answers, QuestionResult } from "@/lib/types";

export async function POST(request: Request, ctx: RouteContext<"/api/quizzes/[id]/attempts">) {
  const { id } = await ctx.params;
  const quiz = getQuiz(id);
  if (!quiz || quiz.status !== "ready") {
    return Response.json({ error: "Quiz not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const answers: Answers = body?.answers && typeof body.answers === "object" ? body.answers : {};

  const results = new Map<string, QuestionResult>();
  const longItems: { question: (typeof quiz.questions)[number]; answer: string }[] = [];

  for (const q of quiz.questions) {
    const a = answers[q.id];
    const local = gradeLocally(q, a);
    if (local) {
      results.set(q.id, local);
      continue;
    }
    const text = a?.kind === "text" ? a.text.trim() : "";
    if (text) longItems.push({ question: q, answer: text.slice(0, 20_000) });
    else results.set(q.id, { questionId: q.id, status: "unanswered", score: 0, maxScore: q.marks });
  }

  let gradingError: string | null = null;
  try {
    for (const r of await gradeLongAnswers(longItems, quiz.config.model)) results.set(r.questionId, r);
  } catch (err) {
    gradingError = err instanceof Error ? err.message : String(err);
    for (const { question } of longItems) {
      results.set(question.id, {
        questionId: question.id,
        status: "ungraded",
        score: 0,
        maxScore: question.marks,
        feedback: `Could not grade this answer: ${gradingError}`,
      });
    }
  }

  const ordered = quiz.questions.map((q) => results.get(q.id)!);
  const attempt = {
    id: randomUUID(),
    quizId: quiz.id,
    answers,
    results: ordered,
    score: ordered.reduce((n, r) => n + r.score, 0),
    maxScore: ordered.reduce((n, r) => n + r.maxScore, 0),
    createdAt: Date.now(),
  };
  insertAttempt(attempt);

  return Response.json({ attempt, gradingError });
}
