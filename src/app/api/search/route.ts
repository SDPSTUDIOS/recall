import { connection } from "next/server";
import { listDocuments, listQuizzes, listUnits, listVivas } from "@/lib/repo";

export interface SearchItem {
  kind: "unit" | "document" | "quiz" | "viva";
  id: string;
  title: string;
  detail: string;
  href: string;
}

/** Everything the command palette can jump to: units, materials, question sets and vivas, newest first. */
export async function GET() {
  // The library changes between requests, so never prerender this.
  await connection();
  const units = listUnits();
  const unitName = new Map(units.map((u) => [u.id, u.code ?? u.name]));
  const items: SearchItem[] = [
    ...units.map((u) => ({
      kind: "unit" as const,
      id: u.id,
      title: u.name,
      detail: [u.code, `${u.documentCount} ${u.documentCount === 1 ? "material" : "materials"}`].filter(Boolean).join(" · "),
      href: `/units/${u.id}`,
    })),
    ...listQuizzes().map((q) => ({
      kind: "quiz" as const,
      id: q.id,
      title: q.title,
      detail:
        q.status === "ready"
          ? `${q.questions.length} questions`
          : q.status === "generating"
            ? "Generating"
            : "Generation failed",
      href: `/quizzes/${q.id}`,
    })),
    ...listDocuments().map((d) => ({
      kind: "document" as const,
      id: d.id,
      title: d.name,
      detail: `${unitName.get(d.unitId) ?? ""} · ${d.pageCount} pages`.replace(/^ · /, ""),
      href: `/documents/${d.id}`,
    })),
    ...listVivas().map((v) => ({
      kind: "viva" as const,
      id: v.id,
      title: v.title,
      detail: v.result ? `Scored ${v.result.score}%` : v.repoName,
      href: `/vivas/${v.id}`,
    })),
  ];
  return Response.json({ items });
}
