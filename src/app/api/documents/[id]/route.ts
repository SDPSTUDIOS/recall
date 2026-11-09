import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { deleteDocument, getDocument, getUnit, moveDocument, renameDocument } from "@/lib/repo";

/** Renames a document ({ name }) or moves it to another unit ({ unitId }). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  if (!getDocument(id)) return Response.json({ error: "Not found" }, { status: 404 });

  if (body?.unitId !== undefined) {
    const unitId = String(body.unitId);
    if (!getUnit(unitId)) return Response.json({ error: "That unit no longer exists." }, { status: 400 });
    moveDocument(id, unitId);
  }
  if (body?.name !== undefined) {
    const name = String(body.name).trim().slice(0, 200);
    if (!name) return Response.json({ error: "The name can't be empty." }, { status: 400 });
    renameDocument(id, name);
  }
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
