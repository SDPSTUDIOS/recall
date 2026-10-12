import { deleteQuiz, getQuiz, renameQuiz } from "@/lib/repo";

export async function GET(_req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  const { id } = await ctx.params;
  const quiz = getQuiz(id);
  if (!quiz) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ status: quiz.status, error: quiz.error });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim().slice(0, 120);
  if (!title) return Response.json({ error: "The title can't be empty." }, { status: 400 });
  if (!renameQuiz(id, title)) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/quizzes/[id]">) {
  const { id } = await ctx.params;
  deleteQuiz(id);
  return Response.json({ ok: true });
}
