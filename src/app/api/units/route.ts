import { randomUUID } from "node:crypto";
import { connection } from "next/server";
import { insertUnit, listUnits } from "@/lib/repo";
import { parseUnitFields } from "@/lib/units";

export async function GET() {
  // Units change between requests, so never prerender this.
  await connection();
  return Response.json({ units: listUnits() });
}

export async function POST(request: Request) {
  const fields = parseUnitFields(await request.json().catch(() => null));
  if (fields.error) return Response.json({ error: fields.error }, { status: 400 });
  if (!fields.name) return Response.json({ error: "Give the unit a name." }, { status: 400 });

  const unit = { id: randomUUID(), name: fields.name, code: fields.code ?? null, createdAt: Date.now() };
  insertUnit(unit);
  return Response.json({ unit });
}
