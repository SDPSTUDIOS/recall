/** Reads a unit's name and optional course code from a request body. */
export function parseUnitFields(body: unknown): { name?: string; code?: string | null; error?: string } {
  const b = (body ?? {}) as { name?: unknown; code?: unknown };
  const out: { name?: string; code?: string | null } = {};
  if (b.name !== undefined) {
    const name = String(b.name).trim().slice(0, 120);
    if (!name) return { error: "Give the unit a name." };
    out.name = name;
  }
  if (b.code !== undefined) {
    const code = b.code === null ? "" : String(b.code).trim().slice(0, 32);
    out.code = code || null;
  }
  return out;
}
