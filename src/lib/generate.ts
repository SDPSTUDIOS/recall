import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { runClaude } from "./claude";
import { UPLOAD_DIR, WORK_DIR } from "./db";
import { completeQuiz, failQuiz, getDocumentPages, getDocuments, getQuiz } from "./repo";
import { shuffleOptions } from "./shuffle";
import {
  BLANK_TOKEN,
  QUESTION_TYPES,
  type Difficulty,
  type GenerationConfig,
  ARTIFACT_KINDS,
  type Artifact,
  type ChartSpec,
  type Question,
  type QuestionType,
} from "./types";
import { MATH_RULE } from "./notation";

/** ~150k tokens of lecture text; beyond this, ask for a page range. */
export const MAX_TEXT_CHARS = 600_000;
/** Pages Claude reads as images in Visual mode, across all documents. */
export const MAX_VISUAL_PAGES = 200;

const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: QUESTION_TYPES.map((t) => t.type) },
    question: { type: "string" },
    options: { type: "array", items: { type: "string" } },
    correctOptions: { type: "array", items: { type: "integer" } },
    blanks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { answers: { type: "array", items: { type: "string" } } },
        required: ["answers"],
      },
    },
    artifact: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["none", ...ARTIFACT_KINDS] },
        title: { type: "string" },
        language: { type: "string" },
        content: { type: "string" },
        table: {
          type: "object",
          additionalProperties: false,
          properties: {
            columns: { type: "array", items: { type: "string" } },
            rows: { type: "array", items: { type: "array", items: { type: "string" } } },
          },
          required: ["columns", "rows"],
        },
        chart: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: { type: "string", enum: ["line", "scatter", "bar"] },
            xLabel: { type: "string" },
            yLabel: { type: "string" },
            categories: { type: "array", items: { type: "string" } },
            series: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  name: { type: "string" },
                  x: { type: "array", items: { type: "number" } },
                  y: { type: "array", items: { type: "number" } },
                },
                required: ["name", "x", "y"],
              },
            },
          },
          required: ["type", "xLabel", "yLabel", "categories", "series"],
        },
      },
      required: ["kind", "title", "language", "content", "table", "chart"],
    },
    modelAnswer: { type: "string" },
    keyPoints: { type: "array", items: { type: "string" } },
    marks: { type: "integer" },
    explanation: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    topic: { type: "string" },
    source: { type: "string" },
  },
  required: [
    "type", "question", "options", "correctOptions", "blanks", "artifact", "modelAnswer",
    "keyPoints", "marks", "explanation", "difficulty", "topic", "source",
  ],
};

const generationSchema = {
  type: "object",
  additionalProperties: false,
  properties: { questions: { type: "array", items: questionSchema } },
  required: ["questions"],
};

const SYSTEM_PROMPT = `You are an experienced university examiner in whatever field the material comes from, whether that is mathematics, engineering, nursing, science, business, law, the humanities or computing. You write exam questions that test real understanding of the lecture material a student gives you: concepts, reasoning, definitions, processes, calculations, comparisons, and application. Ground every question and answer strictly in the provided material; do not introduce facts the material does not support. Avoid trivia about slide layout, lecturer names, course codes, or page numbers. Write in clear plain text (no Markdown). ${MATH_RULE} Return the questions only through the structured output.`;

const TYPE_RULES: Record<QuestionType, string> = {
  mcq: `"mcq" (multiple choice, select all that apply): 4-6 options in "options"; 2 or more correct, given as zero-based indices in "correctOptions". Distractors must be plausible and drawn from related concepts in the material. Do not use "all of the above"/"none of the above". Options are shuffled before display, so never refer to another option by letter or position (e.g. "both A and B"). marks: 2.`,
  single: `"single" (single answer, radio buttons): usually 4 options, exactly one correct index in "correctOptions". Options are shuffled before display, so never refer to another option by letter or position. Occasionally a True/False statement with options ["True", "False"]. marks: 1.`,
  fill_blank: `"fill_blank": a sentence or short passage from the material's ideas with 1-3 key terms replaced by the exact token ${BLANK_TOKEN}. "blanks" has one entry per ${BLANK_TOKEN}, in order, each listing all reasonable accepted answers (synonyms, abbreviations, spelling variants). Each answer is 1-4 words or a number and must be unambiguous from context. Accepted answers are what a student would type on a keyboard, never LaTeX (e.g. "x^2", "9.81", "sqrt(2)"). marks: 1 per blank.`,
  long_answer: `"long_answer": a question that needs a structured written answer (explain, compare, evaluate, apply to a scenario). "modelAnswer" is a full high-scoring answer. "keyPoints" lists 3-6 distinct marking points a grader should look for. marks: 4-10 matching the number and weight of key points.`,
  artifact: `"artifact": the student is shown a concrete artifact and must work with it, the way a real exam in this field would. Choose the kind that suits the material, and use different kinds across questions when the material supports them:
  - "math": equations, formulas or a worked derivation. "artifact.content" holds LaTeX, one display equation per line, with no $ or \\[ \\] delimiters. Tasks: solve, derive, simplify, evaluate for given values, find the error in a working, or interpret what the formula means.
  - "chart": a graph to read and interpret. Fill "artifact.chart": "type" is "line" (trends, functions, curves), "scatter" (paired measurements) or "bar" (comparing categories); "xLabel" and "yLabel" name each axis with units; at most 3 "series", each with a short "name". Line and scatter series give matching "x" and "y" number arrays; plot a function with 25-60 evenly spaced points. Bar charts list labels in "categories" and give each series a "y" with one value per category, leaving "x" empty. Use realistic values. Tasks: read off values, describe and explain a trend, compare series, estimate a gradient, area or rate, or connect the shape to a concept.
  - "table": data to analyse, such as lab or test results, patient observations, a medication chart, financial figures or experimental measurements. Fill "artifact.table" with "columns" (headings with units) and "rows" (each row has one cell per column, at most 15 rows). Tasks: calculate, identify what is abnormal or significant, compare, or justify a decision from the data.
  - "text": a short case study, clinical or workplace scenario, primary source excerpt, problem statement or passage (40-200 words) in "artifact.content". Tasks: apply the material to the case, prioritise actions, assess, analyse, or critique.
  - "code" (only for programming or computing material; a worked calculation is "math"): a code snippet, pseudo-code, SQL query, algorithm, shell command, configuration file or regular expression in "artifact.content" with its original line breaks and indentation, never Markdown fences; "artifact.language" names it (e.g. "python", "sql", "pseudocode"). Tasks: explain, trace and give the output, find and fix a bug, or analyse complexity or behaviour.
  Only "code" uses "language". "title" is a short caption (e.g. "Figure 1: Stress-strain curve for mild steel" or "Patient observations, day 2"). Take the artifact from the material (verbatim or lightly trimmed) when the material has one; otherwise create a short realistic one that applies exactly what the material teaches. "question" states the task without repeating the artifact. "modelAnswer" is a full high-scoring answer that shows any working. "keyPoints" lists 3-6 marking points. marks: 3-8.`,
};

function buildInput(
  config: GenerationConfig,
  material: { kind: "text"; text: string } | { kind: "pdf"; parts: PdfPart[] },
  docNames: string[],
): string {
  const multi = docNames.length > 1;
  const wanted = QUESTION_TYPES.filter((t) => config.counts[t.type] > 0);
  const total = wanted.reduce((n, t) => n + config.counts[t.type], 0);

  const difficulty =
    config.difficulty === "mixed"
      ? "Mix difficulties: roughly 30% easy, 50% medium, 20% hard."
      : `All questions should be ${config.difficulty} difficulty.`;

  const lines = [
    `Create a practice exam of exactly ${total} questions from the lecture material.`,
    "",
    "Question counts (exact):",
    ...wanted.map((t) => `- ${config.counts[t.type]} × "${t.type}"`),
    "",
    "Rules per type:",
    ...wanted.map((t) => `- ${TYPE_RULES[t.type]}`),
    "",
    "Rules for every question:",
    `- ${difficulty}`,
    "- Cover the breadth of the material; do not ask the same thing twice.",
    `- "explanation": 1-3 sentences on why the answer is correct, referring to the material.`,
    multi
      ? `- "topic": a short topic label. "source": the document and page it comes from (e.g. "${docNames[0]}, p. 12").`
      : `- "topic": a short topic label. "source": where in the material it comes from (e.g. "p. 12" or a section heading).`,
    `- Fields that do not apply to a question type must be empty ("" or []). Questions that are not "artifact" set artifact.kind to "none" and leave every other artifact field empty; inside an artifact, fill only the fields its kind uses.`,  ];

  if (multi) {
    lines.push(
      `- The material comes from ${docNames.length} documents: ${docNames.map((n) => `"${n}"`).join(", ")}. Spread the questions across all of them, roughly in proportion to how much each covers. Where it fits naturally, especially for long answers, ask questions that connect ideas across documents.`,
    );
  }

  if (config.focus.trim()) {
    lines.push(`- Focus on these topics where the material allows: ${config.focus.trim()}`);
  }

  lines.push("");
  if (material.kind === "pdf") {
    lines.push(
      "The lecture material is split into these PDF files in the current directory. Read every one of them with the Read tool (the whole file, without the \"pages\" parameter), paying attention to diagrams, graphs, equations and tables, which can become artifacts:",
      ...material.parts.map((p) => `- ${p.fileName}: "${p.docName}", pages ${p.from}-${p.to}`),
      "Use the original document page numbers above in \"source\". If you cannot read the files, return an empty questions array.",
    );
  } else {
    lines.push("<lecture_material>", material.text, "</lecture_material>");
  }
  return lines.join("\n");
}

function selectPages(pages: string[], from: number, to: number): string {
  const start = from > 0 ? Math.max(1, from) : 1;
  const end = to > 0 ? Math.min(pages.length, to) : pages.length;
  const parts: string[] = [];
  for (let i = start; i <= end; i++) {
    const text = pages[i - 1]?.trim();
    if (text) parts.push(`--- Page ${i} ---\n${text}`);
  }
  return parts.join("\n\n");
}

/** Repairs or drops malformed questions so the UI can trust the shape. */
function sanitize(raw: Partial<Question>[]): Question[] {
  const out: Question[] = [];
  for (const r of raw) {
    const type = r.type as QuestionType;
    if (!QUESTION_TYPES.some((t) => t.type === type) || !r.question?.trim()) continue;

    const q: Question = {
      id: randomUUID(),
      type,
      question: r.question.trim(),
      options: (r.options ?? []).map((o) => String(o).trim()).filter(Boolean),
      correctOptions: [],
      blanks: [],
      modelAnswer: r.modelAnswer?.trim() ?? "",
      keyPoints: (r.keyPoints ?? []).filter((p) => p?.trim()),
      marks: Math.max(1, Math.round(Number(r.marks) || 1)),
      explanation: r.explanation?.trim() ?? "",
      difficulty: (["easy", "medium", "hard"] as Difficulty[]).includes(r.difficulty as Difficulty)
        ? (r.difficulty as Difficulty)
        : "medium",
      topic: r.topic?.trim() ?? "",
      source: r.source?.trim() ?? "",
    };

    if (type === "mcq" || type === "single") {
      const valid = [...new Set(r.correctOptions ?? [])].filter(
        (i) => Number.isInteger(i) && i >= 0 && i < q.options.length,
      );
      if (q.options.length < 2 || valid.length === 0) continue;
      q.correctOptions = type === "single" ? [valid[0]] : valid.sort((a, b) => a - b);
    }

    if (type === "fill_blank") {
      const tokenCount = q.question.split(BLANK_TOKEN).length - 1;
      const blanks = (r.blanks ?? [])
        .map((b) => ({ answers: (b.answers ?? []).map((a) => String(a).trim()).filter(Boolean) }))
        .filter((b) => b.answers.length);
      if (tokenCount === 0 || blanks.length < tokenCount) continue;
      q.blanks = blanks.slice(0, tokenCount);
      q.marks = Math.max(q.marks, 1);
    }

    if ((type === "long_answer" || type === "artifact") && (!q.modelAnswer || q.keyPoints.length === 0)) continue;

    if (type === "artifact") {
      const artifact = sanitizeArtifact(r.artifact);
      if (!artifact) continue;
      q.artifact = artifact;
    }

    out.push(shuffleOptions(q).question);
  }
  const order = QUESTION_TYPES.map((t) => t.type);
  return out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

const MAX_SERIES = 3;
const MAX_POINTS = 200;
const MAX_TABLE_ROWS = 30;

/** Returns a renderable artifact of the kind Claude chose, or null if it is unusable. */
function sanitizeArtifact(raw: Partial<Artifact> | undefined): Artifact | null {
  if (!raw) return null;
  const kind = raw.kind && (ARTIFACT_KINDS as readonly string[]).includes(raw.kind) ? raw.kind : "code";
  const title = raw.title?.trim() ?? "";
  const base = { kind, title, language: "", content: "" };

  if (kind === "chart") {
    const chart = sanitizeChart(raw.chart);
    return chart ? { ...base, chart } : null;
  }

  if (kind === "table") {
    const columns = (raw.table?.columns ?? []).map((c) => String(c).trim());
    const rows = (raw.table?.rows ?? [])
      .filter((r) => Array.isArray(r) && r.some((c) => String(c).trim()))
      .slice(0, MAX_TABLE_ROWS)
      .map((r) => columns.map((_, i) => String(r[i] ?? "").trim()));
    return columns.length && rows.length ? { ...base, table: { columns, rows } } : null;
  }

  const content = stripFences(raw.content ?? "");
  if (!content.trim()) return null;
  if (kind === "math") {
    // One equation per line; drop any delimiters Claude added anyway.
    const lines = content
      .split("\n")
      .map((l) => l.trim().replace(/^(\$\$|\$|\\\[)/, "").replace(/(\$\$|\$|\\\])$/, "").trim())
      .filter(Boolean);
    return lines.length ? { ...base, content: lines.join("\n") } : null;
  }
  if (kind === "code") return { ...base, language: raw.language?.trim().toLowerCase() || "text", content };
  return { ...base, content: content.trim() };
}

function sanitizeChart(raw: Partial<ChartSpec> | undefined): ChartSpec | null {
  if (!raw || !["line", "scatter", "bar"].includes(raw.type ?? "")) return null;
  const type = raw.type as ChartSpec["type"];
  const categories = (raw.categories ?? []).map((c) => String(c).trim()).slice(0, 24);
  const series: ChartSpec["series"] = [];

  for (const s of (raw.series ?? []).slice(0, MAX_SERIES)) {
    const name = String(s?.name ?? "").trim();
    if (type === "bar") {
      const y = (s?.y ?? []).slice(0, categories.length).map(Number);
      if (y.length === categories.length && y.every(Number.isFinite)) series.push({ name, x: [], y });
    } else {
      // Keep only complete, finite points, in x order so lines draw left to right.
      const points = (s?.x ?? [])
        .map((x, i) => [Number(x), Number(s?.y?.[i])] as const)
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
        .slice(0, MAX_POINTS);
      if (type === "line") points.sort((a, b) => a[0] - b[0]);
      if (points.length >= 2) series.push({ name, x: points.map((p) => p[0]), y: points.map((p) => p[1]) });
    }
  }

  if (series.length === 0 || (type === "bar" && categories.length === 0)) return null;
  // Each series needs a name for the legend and tooltip once there is more than one.
  if (series.length > 1) series.forEach((s, i) => (s.name ||= `Series ${i + 1}`));
  return {
    type,
    xLabel: raw.xLabel?.trim() ?? "",
    yLabel: raw.yLabel?.trim() ?? "",
    categories: type === "bar" ? categories : [],
    series,
  };
}

/** Removes Markdown code fences and surrounding blank lines, keeping indentation. */
function stripFences(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .replace(/^\s*```[^\n]*\n/, "")
    .replace(/\n```\s*$/, "")
    .replace(/^(\s*\n)+/, "")
    .trimEnd();
}

declare global {
  var __examHelperRunning: Set<string> | undefined;
}
interface PdfPart {
  fileName: string;
  docName: string;
  from: number;
  to: number;
}

/**
 * Claude Code reads a PDF of up to 10 pages whole, while page ranges need
 * Poppler (pdftoppm), which most Windows machines lack. So we cut the selected
 * pages into chunks of PAGES_PER_PART and let Claude read each one whole.
 */
const PAGES_PER_PART = 10;

async function splitPdf(
  src: string,
  docName: string,
  prefix: string,
  outDir: string,
  from: number,
  to: number,
): Promise<PdfPart[]> {
  const source = await PDFDocument.load(await fs.readFile(src), { ignoreEncryption: true });
  const total = source.getPageCount();
  const start = from > 0 ? from : 1;
  const end = to > 0 ? Math.min(to, total) : total;

  await fs.mkdir(outDir, { recursive: true });
  const parts: PdfPart[] = [];
  for (let first = start; first <= end; first += PAGES_PER_PART) {
    const last = Math.min(end, first + PAGES_PER_PART - 1);
    const part = await PDFDocument.create();
    const indices = Array.from({ length: last - first + 1 }, (_, i) => first - 1 + i);
    for (const page of await part.copyPages(source, indices)) part.addPage(page);
    const fileName = `${prefix}pages-${String(first).padStart(3, "0")}-${String(last).padStart(3, "0")}.pdf`;
    await fs.writeFile(path.join(outDir, fileName), await part.save());
    parts.push({ fileName, docName, from: first, to: last });
  }
  return parts;
}

const running = (globalThis.__examHelperRunning ??= new Set<string>());

/** Starts generation in the background; the quiz row tracks progress. */
export function startGeneration(quizId: string) {
  if (running.has(quizId)) return;
  running.add(quizId);
  generate(quizId)
    .catch((err) => failQuiz(quizId, err instanceof Error ? err.message : String(err)))
    .finally(() => running.delete(quizId));
}

async function generate(quizId: string) {
  const quiz = getQuiz(quizId);
  if (!quiz) return;
  const docs = getDocuments(quiz.documents.map((d) => d.id));
  if (docs.length === 0) throw new Error("The source documents were deleted.");
  const config = quiz.config;
  // Page ranges only apply to single-document sets (the API enforces this).
  const [from, to] = docs.length === 1 ? [config.pageFrom, config.pageTo] : [0, 0];
  const names = docs.map((d) => d.name);

  let input: string;
  let tools: string[] = [];
  let cwd: string | undefined;

  if (config.mode === "visual") {
    const pages = docs.length === 1 && from > 0 ? to - from + 1 : docs.reduce((n, d) => n + d.pageCount, 0);
    if (pages > MAX_VISUAL_PAGES) {
      throw new Error(
        `Visual mode is limited to ${MAX_VISUAL_PAGES} pages per set, and this selection has ${pages}. Use Text mode, or choose fewer documents or pages.`,
      );
    }
    cwd = path.join(WORK_DIR, quizId);
    const parts: PdfPart[] = [];
    for (const [i, doc] of docs.entries()) {
      const prefix = docs.length > 1 ? `doc${String(i + 1).padStart(2, "0")}-` : "";
      parts.push(...(await splitPdf(path.join(UPLOAD_DIR, doc.fileName), doc.name, prefix, cwd, from, to)));
    }
    input = buildInput(config, { kind: "pdf", parts }, names);
    tools = ["Read"];
  } else {
    const sections: string[] = [];
    for (const doc of docs) {
      const text = selectPages(getDocumentPages(doc.id), from, to);
      if (text.length < 200) {
        throw new Error(
          docs.length > 1
            ? `"${doc.name}" has almost no extractable text (it is probably scanned or image-based). Use Visual mode, or leave it out.`
            : "Not enough text could be extracted from these pages. If the PDF is scanned or mostly images, use Visual mode.",
        );
      }
      sections.push(
        docs.length > 1 ? `<document title="${doc.name.replace(/"/g, "'")}">\n${text}\n</document>` : text,
      );
    }
    const text = sections.join("\n\n");
    if (text.length > MAX_TEXT_CHARS) {
      throw new Error(
        `The selected material contains ${text.length.toLocaleString()} characters, more than the ${MAX_TEXT_CHARS.toLocaleString()} limit. ${
          docs.length > 1 ? "Choose fewer documents." : "Choose a smaller page range."
        }`,
      );
    }
    input = buildInput(config, { kind: "text", text }, names);
  }

  const { output, modelUsed, durationMs } = await runClaude<{ questions: Partial<Question>[] }>({
    input,
    systemPrompt: SYSTEM_PROMPT,
    model: config.model,
    effort: config.effort,
    schema: generationSchema,
    tools,
    cwd,
  }).finally(() => {
    if (config.mode === "visual" && cwd) fs.rm(cwd, { recursive: true, force: true }).catch(() => {});
  });

  // Keep the raw response of the latest run for troubleshooting.
  await fs
    .writeFile(path.join(WORK_DIR, "last-generation.json"), JSON.stringify({ quizId, output }, null, 2))
    .catch(() => {});

  const raw = output.questions ?? [];
  const questions = sanitize(raw);
  if (questions.length === 0) {
    throw new Error(
      raw.length
        ? `Claude returned ${raw.length} question(s), but none were in a usable format. Try again or pick another model.`
        : "Claude did not return any questions. Try again or pick another model.",
    );
  }
  completeQuiz(quizId, questions, modelUsed, durationMs);
}
