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
  type Question,
  type QuestionType,
} from "./types";

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
      properties: { language: { type: "string" }, content: { type: "string" } },
      required: ["language", "content"],
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

const SYSTEM_PROMPT = `You are an experienced university examiner. You write exam questions that test real understanding of the lecture material a student gives you: concepts, reasoning, definitions, processes, comparisons, and application. Ground every question and answer strictly in the provided material; do not introduce facts the material does not support. Avoid trivia about slide layout, lecturer names, course codes, or page numbers. Write in clear plain text (no Markdown). Return the questions only through the structured output.`;

const TYPE_RULES: Record<QuestionType, string> = {
  mcq: `"mcq" (multiple choice, select all that apply): 4-6 options in "options"; 2 or more correct, given as zero-based indices in "correctOptions". Distractors must be plausible and drawn from related concepts in the material. Do not use "all of the above"/"none of the above". Options are shuffled before display, so never refer to another option by letter or position (e.g. "both A and B"). marks: 2.`,
  single: `"single" (single answer, radio buttons): usually 4 options, exactly one correct index in "correctOptions". Options are shuffled before display, so never refer to another option by letter or position. Occasionally a True/False statement with options ["True", "False"]. marks: 1.`,
  fill_blank: `"fill_blank": a sentence or short passage from the material's ideas with 1-3 key terms replaced by the exact token ${BLANK_TOKEN}. "blanks" has one entry per ${BLANK_TOKEN}, in order, each listing all reasonable accepted answers (synonyms, abbreviations, spelling variants). Each answer is 1-4 words and must be unambiguous from context. marks: 1 per blank.`,
  long_answer: `"long_answer": a question that needs a structured written answer (explain, compare, evaluate, apply to a scenario). "modelAnswer" is a full high-scoring answer. "keyPoints" lists 3-6 distinct marking points a grader should look for. marks: 4-10 matching the number and weight of key points.`,
  artifact: `"artifact": the student is shown a concrete artifact and must work with it. "artifact.content" holds it as plain text with its original line breaks and indentation, never Markdown fences: a code snippet, pseudo-code, SQL query, algorithm, shell command, configuration file, regular expression, formula or data table. Take it from the material (verbatim or lightly trimmed) when the material has one; otherwise write a short realistic one (5-30 lines) that applies exactly what the material teaches. "artifact.language" names it (e.g. "python", "java", "sql", "pseudocode", "text"). "question" states the task without repeating the artifact. Vary the tasks: explain what it does and why, trace it and give the output or final state for a given input, find and fix a bug, analyse complexity or behaviour, or connect it to a concept from the material. "modelAnswer" is a full high-scoring answer that may refer to line numbers. "keyPoints" lists 3-6 marking points. marks: 3-8.`,
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
    `- Fields that do not apply to a question type must be empty ("", [] or, for "artifact", {"language": "", "content": ""}).`,
  ];

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
      "The lecture material is split into these PDF files in the current directory. Read every one of them with the Read tool (the whole file, without the \"pages\" parameter), paying attention to diagrams, charts and tables:",
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
      const content = stripFences(r.artifact?.content ?? "");
      if (!content.trim()) continue;
      q.artifact = { language: r.artifact?.language?.trim().toLowerCase() || "text", content };
    }

    out.push(shuffleOptions(q).question);
  }
  const order = QUESTION_TYPES.map((t) => t.type);
  return out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
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
