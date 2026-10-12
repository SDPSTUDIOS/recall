import { isWritten, type Answer, type Question, type QuestionResult } from "./types";

/** Normalises a typed answer for lenient comparison. */
export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[“”"'`’]/g, "")
    .replace(/[^\p{L}\p{N}.+\-/%\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "")
    .replace(/\.$/, "");
}

function blankMatches(value: string, accepted: string[]): boolean {
  const v = normalizeAnswer(value);
  if (!v) return false;
  const num = Number(v.replace(/,/g, ""));
  return accepted.some((a) => {
    const n = normalizeAnswer(a);
    if (n === v) return true;
    const an = Number(n.replace(/,/g, ""));
    return !Number.isNaN(num) && !Number.isNaN(an) && Math.abs(num - an) < 1e-9;
  });
}

const roundHalf = (n: number) => Math.round(n * 2) / 2;

function statusFor(score: number, max: number): QuestionResult["status"] {
  if (score >= max) return "correct";
  if (score > 0) return "partial";
  return "incorrect";
}

export function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (!a) return false;
  if (a.kind === "choice") return a.selected.length > 0;
  if (a.kind === "blanks") return a.values.some((v) => v.trim());
  return a.text.trim().length > 0;
}

/**
 * Grades objective questions locally. Written answers return null and need
 * Claude (see /api/quizzes/[id]/attempts).
 */
export function gradeLocally(q: Question, a: Answer | undefined): QuestionResult | null {
  const max = q.marks;
  const base = { questionId: q.id, maxScore: max };

  if (isWritten(q.type)) return null;
  if (!isAnswered(q, a)) return { ...base, status: "unanswered", score: 0 };

  if (q.type === "single") {
    const picked = a?.kind === "choice" ? a.selected[0] : undefined;
    const score = picked === q.correctOptions[0] ? max : 0;
    return { ...base, status: statusFor(score, max), score };
  }

  if (q.type === "mcq") {
    const picked = new Set(a?.kind === "choice" ? a.selected : []);
    const correct = new Set(q.correctOptions);
    let hits = 0;
    let wrong = 0;
    for (const p of picked) {
      if (correct.has(p)) hits++;
      else wrong++;
    }
    // Partial credit: each wrong tick cancels a right one.
    const score =
      hits === correct.size && wrong === 0
        ? max
        : roundHalf(Math.max(0, (hits - wrong) / correct.size) * max);
    return { ...base, status: statusFor(score, max), score };
  }

  // fill_blank
  const values = a?.kind === "blanks" ? a.values : [];
  const blankCorrect = q.blanks.map((b, i) => blankMatches(values[i] ?? "", b.answers));
  const right = blankCorrect.filter(Boolean).length;
  const score = roundHalf((right / q.blanks.length) * max);
  return { ...base, status: statusFor(score, max), score, blankCorrect };
}
