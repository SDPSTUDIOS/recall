import "server-only";
import { MATH_RULE } from "./notation";
import { BLANK_TOKEN, TYPE_LABEL, type Answer, type Question, type TutorMessage } from "./types";

const BASE = `You are a patient university tutor helping a student with one exam practice question. The question, its marking scheme and any artifact (code, equations in LaTeX, a chart given as data series, a data table or a case study) are below. Work from them: refer to specific lines, values, options or parts of the case rather than speaking in generalities.

Be clear and concise. Start with what the student asked, keep replies to a few short paragraphs, and break methods into numbered steps. Where it helps, check understanding or suggest what the student could try next. If the question or marking scheme looks wrong, say so plainly.

Formatting: plain text. Short paragraphs, "- " for bullet points, "1. " for steps. No markdown headings, bold or tables. Put code in \`\`\` fences. ${MATH_RULE}`;

const HINTS_ONLY = `The student is still answering, so do not give the answer away. Do not say which option is correct or incorrect, do not fill in the blanks, do not state the final value or conclusion, and do not write a model answer. Instead explain what the question is asking, define the terms and concepts involved, and show the method or the steps to reach an answer, using a different example where a worked example helps. If the student shares an attempt, say whether they are heading in the right direction and point to what to reconsider, without correcting it into the answer. If they ask outright for the answer, say kindly that it's shown once they check the answer or submit, and give a stronger hint instead.`;

const FULL = `The answer has been revealed to the student, so you may discuss it fully: explain why the correct answer is correct, why the other options or approaches are wrong, and walk through the full working. If the student's answer and marks are included, explain what they got right and where they lost marks.`;

function describeAnswer(q: Question, a: Answer | undefined): string | null {
  if (!a) return null;
  if (a.kind === "choice") {
    return a.selected.length ? a.selected.map((i) => `${"ABCDEFGHIJ"[i]}. ${q.options[i] ?? ""}`).join("\n") : null;
  }
  if (a.kind === "blanks") return a.values.some((v) => v.trim()) ? a.values.map((v, i) => `Blank ${i + 1}: ${v}`).join("\n") : null;
  return a.text.trim() ? a.text.slice(0, 10_000) : null;
}

export function tutorSystemPrompt(revealed: boolean) {
  return `${BASE}\n\n${revealed ? FULL : HINTS_ONLY}`;
}

/** The question, what the student has so far, and the conversation, as one prompt. */
export function tutorInput({
  question: q,
  answer,
  revealed,
  feedback,
  messages,
}: {
  question: Question;
  answer?: Answer;
  revealed: boolean;
  feedback?: string;
  messages: TutorMessage[];
}) {
  const context = {
    type: TYPE_LABEL[q.type],
    question: q.type === "fill_blank" ? q.question.replaceAll(BLANK_TOKEN, "____") : q.question,
    ...(q.options.length ? { options: q.options.map((o, i) => `${"ABCDEFGHIJ"[i]}. ${o}`) } : {}),
    ...(q.artifact ? { artifact: q.artifact } : {}),
    marks: q.marks,
    topic: q.topic,
    source: q.source,
    // The tutor needs the scheme to guide well even when it mustn't reveal it.
    markingScheme: {
      ...(q.correctOptions.length ? { correctOptions: q.correctOptions.map((i) => "ABCDEFGHIJ"[i]) } : {}),
      ...(q.blanks.length ? { blankAnswers: q.blanks.map((b) => b.answers) } : {}),
      keyPoints: q.keyPoints,
      modelAnswer: q.modelAnswer,
      explanation: q.explanation,
    },
  };
  const studentAnswer = describeAnswer(q, answer);
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content}`)
    .join("\n\n");

  return [
    `QUESTION (${revealed ? "answer revealed" : "still answering: hints only"})`,
    JSON.stringify(context, null, 2),
    studentAnswer ? `STUDENT'S ANSWER SO FAR\n${studentAnswer}` : "The student hasn't answered yet.",
    feedback ? `EXAMINER FEEDBACK ON THEIR ANSWER\n${feedback}` : "",
    `CONVERSATION\n${transcript}`,
    "Reply to the student's last message as the tutor. Write only the reply.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
