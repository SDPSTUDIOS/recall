import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { deleteDocument, getDocument, renameDocument } from "@/lib/repo";

export async function PATCH(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim().slice(0, 200);
  if (!name) return Response.json({ error: "The name can't be empty." }, { status: 400 });
  if (!renameDocument(id, name)) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const doc = getDocument(id);
  if (!doc) return Response.json({ error: "Not found" }, { status: 404 });

  deleteDocument(id);
  await fs.rm(path.join(UPLOAD_DIR, doc.fileName), { force: true });
  return Response.json({ ok: true });
}
