import { randomUUID } from "node:crypto";
import { startGeneration } from "@/lib/generate";
import { getDocuments, insertQuiz, listQuizzes } from "@/lib/repo";
import { QUESTION_TYPES, type GenerationConfig } from "@/lib/types";

const EFFORTS = ["default", "low", "medium", "high", "xhigh", "max"];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

/** "A & B", "A, B & C", or "A … F (6 materials)" for longer selections. */
function combinedTitle(names: string[]): string {
  if (names.length <= 3) {
    return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
  }
  return `${names[0]} … ${names.at(-1)} (${names.length} materials)`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.documentIds)
    ? [...new Set<string>(body.documentIds.map(String))]
    : body?.documentId
      ? [String(body.documentId)]
      : [];
  const docs = getDocuments(ids);
  if (docs.length === 0 || docs.length !== ids.length) {
    return Response.json({ error: "Select at least one document that still exists." }, { status: 404 });
  }
  const single = docs.length === 1 ? docs[0] : null;

  const model = String(body.model ?? "").trim();
  if (!/^[\w.\-\[\]]{2,80}$/.test(model)) {
    return Response.json({ error: "Enter a valid model alias or ID." }, { status: 400 });
  }

  const counts = Object.fromEntries(
    QUESTION_TYPES.map(({ type }) => [
      type,
      Math.min(40, Math.max(0, Math.floor(Number(body.counts?.[type]) || 0))),
    ]),
  ) as GenerationConfig["counts"];
  if (Object.values(counts).every((n) => n === 0)) {
    return Response.json({ error: "Choose at least one question." }, { status: 400 });
  }

  // Page ranges only make sense for a single document.
  let pageFrom = single ? Math.floor(Number(body.pageFrom) || 0) : 0;
  let pageTo = single ? Math.floor(Number(body.pageTo) || 0) : 0;
  if (single && (pageFrom > 0 || pageTo > 0)) {
    pageFrom = Math.min(Math.max(1, pageFrom || 1), single.pageCount);
    pageTo = Math.min(Math.max(pageFrom, pageTo || single.pageCount), single.pageCount);
    if (pageFrom === 1 && pageTo === single.pageCount) pageFrom = pageTo = 0;
  }

  const config: GenerationConfig = {
    model,
    effort: EFFORTS.includes(body.effort) ? body.effort : "default",
    counts,
    difficulty: DIFFICULTIES.includes(body.difficulty) ? body.difficulty : "mixed",
    pageFrom,
    pageTo,
    focus: String(body.focus ?? "").slice(0, 1000),
    mode: body.mode === "visual" ? "visual" : "text",
  };

  const title =
    String(body.title ?? "").trim().slice(0, 120) ||
    (single
      ? `${single.name}: Set ${listQuizzes(single.id).length + 1}`
      : combinedTitle(docs.map((d) => d.name)));

  const id = randomUUID();
  insertQuiz({ id, documentIds: docs.map((d) => d.id), title, config, createdAt: Date.now() });
  startGeneration(id);

  return Response.json({ id });
}
