import { deleteViva, getViva, renameViva } from "@/lib/repo";
import { removeVivaZip } from "@/lib/viva";

export async function GET(_req: Request, ctx: RouteContext<"/api/vivas/[id]">) {
  const { id } = await ctx.params;
  const viva = getViva(id);
  if (!viva) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ status: viva.status, error: viva.error });
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/vivas/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim().slice(0, 120);
  if (!title) return Response.json({ error: "The title can't be empty." }, { status: 400 });
  if (!renameViva(id, title)) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/vivas/[id]">) {
  const { id } = await ctx.params;
  deleteViva(id);
  await removeVivaZip(id); // still there if preparation never succeeded
  return Response.json({ ok: true });
}
