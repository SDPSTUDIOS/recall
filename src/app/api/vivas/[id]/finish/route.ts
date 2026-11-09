import { ClaudeError } from "@/lib/claude";
import { getViva, saveVivaResult } from "@/lib/repo";
import { assessViva } from "@/lib/viva";

declare global {
  var __examHelperVivaAssessing: Set<string> | undefined;
}
const assessing = (globalThis.__examHelperVivaAssessing ??= new Set<string>());

/** Ends the viva (if the examiner hasn't already) and has Claude assess the answers. */
export async function POST(_req: Request, ctx: RouteContext<"/api/vivas/[id]/finish">) {
  const { id } = await ctx.params;
  const viva = getViva(id);
  if (!viva || viva.status !== "ready" || !viva.brief) {
    return Response.json({ error: "Viva not found." }, { status: 404 });
  }
  if (viva.result) return Response.json({ result: viva.result });
  if (!viva.messages.some((m) => m.role === "user")) {
    return Response.json({ error: "Answer at least one question before ending the viva." }, { status: 400 });
  }
  if (assessing.has(id)) {
    return Response.json({ error: "Your viva is already being assessed." }, { status: 409 });
  }

  assessing.add(id);
  try {
    const result = await assessViva({ ...viva, brief: viva.brief });
    saveVivaResult(id, result);
    return Response.json({ result });
  } catch (err) {
    return Response.json(
      { error: err instanceof ClaudeError ? err.message : "Couldn't assess the viva. Try again." },
      { status: 502 },
    );
  } finally {
    assessing.delete(id);
  }
}
