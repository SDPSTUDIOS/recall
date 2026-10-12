export type QuestionType = "mcq" | "single" | "fill_blank" | "long_answer" | "artifact";

export const QUESTION_TYPES: {
  type: QuestionType;
  label: string;
  description: string;
}[] = [
  {
    type: "mcq",
    label: "Multiple choice",
    description: "Select all that apply (checkboxes)",
  },
  {
    type: "single",
    label: "Single choice",
    description: "One correct answer (radio buttons)",
  },
  {
    type: "fill_blank",
    label: "Fill in the blanks",
    description: "Complete the sentence with missing terms",
  },
  {
    type: "long_answer",
    label: "Long answer",
    description: "Written answers, graded by Claude against a rubric",
  },
  {
    type: "artifact",
    label: "Code & artifacts",
    description: "Explain, trace or debug code or another artifact from the material",
  },
];

/** Answered in writing and graded by Claude rather than in code. */
export const isWritten = (type: QuestionType) => type === "long_answer" || type === "artifact";

export const TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.type, t.label]),
) as Record<QuestionType, string>;

export const BLANK_TOKEN = "[[BLANK]]";

export type Difficulty = "easy" | "medium" | "hard";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctOptions: number[];
  blanks: { answers: string[] }[];
  /** The code or other artifact an "artifact" question is about (absent in older sets). */
  artifact?: { language: string; content: string };
  modelAnswer: string;
  keyPoints: string[];
  marks: number;
  explanation: string;
  difficulty: Difficulty;
  topic: string;
  source: string;
}

export type Effort = "default" | "low" | "medium" | "high" | "xhigh" | "max";

export interface GenerationConfig {
  model: string;
  effort: Effort;
  counts: Record<QuestionType, number>;
  difficulty: Difficulty | "mixed";
  pageFrom: number;
  pageTo: number;
  focus: string;
  mode: "text" | "visual";
}

export type QuizStatus = "generating" | "ready" | "error";

export interface DocumentRecord {
  id: string;
  name: string;
  fileName: string;
  size: number;
  pageCount: number;
  charCount: number;
  createdAt: number;
}

export interface QuizRecord {
  id: string;
  /** Source documents still in the library (a deleted one drops out of this list). */
  documents: { id: string; name: string }[];
  title: string;
  status: QuizStatus;
  error: string | null;
  model: string;
  modelUsed: string | null;
  config: GenerationConfig;
  questions: Question[];
  durationMs: number | null;
  createdAt: number;
  startedAt: number;
}

export type Answer =
  | { kind: "choice"; selected: number[] }
  | { kind: "blanks"; values: string[] }
  | { kind: "text"; text: string };

export type Answers = Record<string, Answer>;

export type ResultStatus =
  | "correct"
  | "partial"
  | "incorrect"
  | "unanswered"
  | "ungraded";

export interface QuestionResult {
  questionId: string;
  status: ResultStatus;
  score: number;
  maxScore: number;
  blankCorrect?: boolean[];
  feedback?: string;
  coveredPoints?: string[];
  missedPoints?: string[];
}

export interface AttemptRecord {
  id: string;
  quizId: string;
  answers: Answers;
  results: QuestionResult[];
  score: number;
  maxScore: number;
  createdAt: number;
}

export const MODEL_PRESETS: { value: string; label: string; hint: string }[] = [
  { value: "sonnet", label: "Sonnet (latest)", hint: "Balanced quality and speed. Good default" },
  { value: "opus", label: "Opus (latest)", hint: "Deep reasoning, best for hard material" },
  { value: "fable", label: "Fable (latest)", hint: "Anthropic's newest family" },
  { value: "haiku", label: "Haiku (latest)", hint: "Fastest, uses the least of your limits" },
];
