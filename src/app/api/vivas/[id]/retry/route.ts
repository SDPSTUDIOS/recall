import { GitError, checkRepoReachable, isGitHubToken, parseGitHubUrl } from "@/lib/github";
import { getViva, markVivaPreparing } from "@/lib/repo";
import { startVivaPrep } from "@/lib/viva";

/**
 * Prepares the viva again. Nothing about a sign-in is kept between attempts, so a
 * private repository answers {needsAuth: true}; send it again with "githubToken".
 */
export async function POST(request: Request, ctx: RouteContext<"/api/vivas/[id]/retry">) {
  const { id } = await ctx.params;
  const viva = getViva(id);
  if (!viva) return Response.json({ error: "Not found" }, { status: 404 });
  if (viva.status === "preparing") return Response.json({ ok: true });

  const body = await request.json().catch(() => null);
  const token = isGitHubToken(body?.githubToken) ? body.githubToken : undefined;
  const ref = viva.source === "github" ? parseGitHubUrl(viva.repoUrl) : null;
  if (ref) {
    try {
      await checkRepoReachable(ref, token);
    } catch (err) {
      return Response.json(
        {
          error: err instanceof GitError ? err.message : "Couldn't check the repository.",
          needsAuth: err instanceof GitError && err.needsAuth,
        },
        { status: 400 },
      );
    }
  }

  markVivaPreparing(id);
  startVivaPrep(id, token);
  return Response.json({ ok: true });
}
