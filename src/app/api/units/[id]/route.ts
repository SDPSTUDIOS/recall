import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { deleteUnit, getUnit, updateUnit } from "@/lib/repo";
import { parseUnitFields } from "@/lib/units";

export async function PATCH(request: Request, ctx: RouteContext<"/api/units/[id]">) {
  const { id } = await ctx.params;
  const fields = parseUnitFields(await request.json().catch(() => null));
  if (fields.error) return Response.json({ error: fields.error }, { status: 400 });
  if (!updateUnit(id, { name: fields.name, code: fields.code })) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return Response.json({ ok: true });
}

/** Deletes the unit with its materials and the question sets made only from them. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/units/[id]">) {
  const { id } = await ctx.params;
  if (!getUnit(id)) return Response.json({ error: "Not found" }, { status: 404 });

  const files = deleteUnit(id);
  await Promise.all(files.map((f) => fs.rm(path.join(UPLOAD_DIR, f), { force: true })));
  return Response.json({ ok: true });
}
