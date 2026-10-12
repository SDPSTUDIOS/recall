import { startGeneration } from "@/lib/generate";
import { getQuiz, markQuizGenerating } from "@/lib/repo";

export async function POST(_req: Request, ctx: RouteContext<"/api/quizzes/[id]/retry">) {
  const { id } = await ctx.params;
  const quiz = getQuiz(id);
  if (!quiz) return Response.json({ error: "Not found" }, { status: 404 });
  if (quiz.status !== "generating") {
    markQuizGenerating(id);
    startGeneration(id);
  }
  return Response.json({ ok: true });
}
