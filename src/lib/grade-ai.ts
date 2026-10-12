import "server-only";
import { runClaude } from "./claude";
import type { Question, QuestionResult } from "./types";

const gradeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    grades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          questionId: { type: "string" },
          score: { type: "number" },
          feedback: { type: "string" },
          coveredPoints: { type: "array", items: { type: "string" } },
          missedPoints: { type: "array", items: { type: "string" } },
        },
        required: ["questionId", "score", "feedback", "coveredPoints", "missedPoints"],
      },
    },
  },
  required: ["grades"],
};

const SYSTEM_PROMPT = `You are a fair, consistent university examiner marking written exam answers against a marking scheme. Award marks for each key point the student genuinely demonstrates, even when worded differently from the model answer. Do not award marks for vague, irrelevant or incorrect statements. Scores may use half marks and must be between 0 and the question's marks. Feedback is 2-4 sentences addressed to the student: what was good, what was missing or wrong, and how to improve. "coveredPoints" and "missedPoints" quote or paraphrase the relevant key points. Some questions include an "artifact" (code or similar) the student had to explain, trace or fix; check the student's claims about it for technical accuracy against the artifact itself. Plain text only.`;

/** Grades long and artifact answers in one Claude call. */
export async function gradeLongAnswers(
  items: { question: Question; answer: string }[],
  model: string,
): Promise<QuestionResult[]> {
  if (items.length === 0) return [];

  const payload = items.map(({ question, answer }) => ({
    questionId: question.id,
    question: question.question,
    ...(question.artifact ? { artifact: question.artifact } : {}),
    marks: question.marks,
    keyPoints: question.keyPoints,
    modelAnswer: question.modelAnswer,
    studentAnswer: answer,
  }));

  const { output } = await runClaude<{
    grades: {
      questionId: string;
      score: number;
      feedback: string;
      coveredPoints: string[];
      missedPoints: string[];
    }[];
  }>({
    input: `Mark each student answer below. Return one grade per questionId.\n\n${JSON.stringify(payload, null, 2)}`,
    systemPrompt: SYSTEM_PROMPT,
    model,
    schema: gradeSchema,
    timeoutMs: 8 * 60 * 1000,
  });

  const byId = new Map(output.grades.map((g) => [g.questionId, g]));
  return items.map(({ question }) => {
    const g = byId.get(question.id);
    if (!g) {
      return {
        questionId: question.id,
        status: "ungraded",
        score: 0,
        maxScore: question.marks,
        feedback: "Claude did not return a grade for this answer.",
      };
    }
    const score = Math.min(question.marks, Math.max(0, Math.round(g.score * 2) / 2));
    return {
      questionId: question.id,
      status: score >= question.marks ? "correct" : score > 0 ? "partial" : "incorrect",
      score,
      maxScore: question.marks,
      feedback: g.feedback,
      coveredPoints: g.coveredPoints,
      missedPoints: g.missedPoints,
    };
  });
}
