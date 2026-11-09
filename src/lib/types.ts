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
    label: "Artifacts",
    description: "Work with an equation, graph, data table, case study or code from the material",
  },
];

/** Answered in writing and graded by Claude rather than in code. */
export const isWritten = (type: QuestionType) => type === "long_answer" || type === "artifact";

export const TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.type, t.label]),
) as Record<QuestionType, string>;

export const BLANK_TOKEN = "[[BLANK]]";

export type Difficulty = "easy" | "medium" | "hard";

export const ARTIFACT_KINDS = ["code", "math", "chart", "table", "text"] as const;
export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export interface ChartSpec {
  type: "line" | "scatter" | "bar";
  xLabel: string;
  yLabel: string;
  /** Bar charts: one label per bar group. Unused by line and scatter charts. */
  categories: string[];
  /** Line and scatter: `x` and `y` pair up. Bar: `y` lines up with `categories`. */
  series: { name: string; x: number[]; y: number[] }[];
}

/** The thing an "artifact" question asks the student to work with. */
export interface Artifact {
  /** Absent in sets made before artifacts had kinds; those are all code. */
  kind?: ArtifactKind;
  title?: string;
  /** Code: the language. Other kinds leave it empty. */
  language: string;
  /** Code, LaTeX equations (one per line) or a passage of text. Empty for charts and tables. */
  content: string;
  table?: { columns: string[]; rows: string[][] };
  chart?: ChartSpec;
}

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options: string[];
  correctOptions: number[];
  blanks: { answers: string[] }[];
  /** What an "artifact" question is about: code, equations, a graph, a table or a case. */
  artifact?: Artifact;
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

/** A course unit (module). Every uploaded document belongs to exactly one. */
export interface UnitRecord {
  id: string;
  name: string;
  /** Optional course code, e.g. "CS2010". */
  code: string | null;
  createdAt: number;
}

export interface UnitSummary extends UnitRecord {
  documentCount: number;
  quizCount: number;
  pageCount: number;
}

export interface DocumentRecord {
  id: string;
  unitId: string;
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

/** One turn of an Ask Claude conversation about a question. */
export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

/** Saved Ask Claude conversations for a question set, by question id. */
export type TutorChats = Record<string, TutorMessage[]>;

// ---------- viva ----------

export type VivaStatus = "preparing" | "ready" | "error";

/** Where the code came from: a GitHub repository, or a zip file the student uploaded. */
export type VivaSource = "github" | "zip";

export interface VivaConfig {
  model: string;
  effort: Effort;
  /** Number of topics the examiner plans to cover. */
  topicCount: number;
  difficulty: Difficulty | "mixed";
  focus: string;
}

/** One planned line of questioning. Private to the examiner: never shown before the viva ends. */
export interface VivaTopic {
  id: string;
  title: string;
  /** The opening question for this topic. */
  question: string;
  files: string[];
  /** What a strong answer shows. */
  lookFor: string[];
  /** Relevant code from the repository, quoted with its path, for the examiner to refer to. */
  excerpt: string;
}

/** What Claude learnt about the project while preparing the viva. */
export interface VivaBrief {
  summary: string;
  stack: string[];
  architecture: string;
  keyFiles: { path: string; purpose: string }[];
  topics: VivaTopic[];
}

export interface VivaMessage extends TutorMessage {
  /** The topic (1-based) being discussed when the message was written; 0 before the first one. */
  topic: number;
}

export interface VivaTopicResult {
  topicId: string;
  /** Whether the viva got to this topic before it ended. */
  reached: boolean;
  /** Out of 10. */
  score: number;
  feedback: string;
}

export interface VivaResult {
  /** 0-100, across the topics that were reached. */
  score: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  topics: VivaTopicResult[];
}

export interface VivaRecord {
  id: string;
  source: VivaSource;
  /** The GitHub link; empty for a zip. */
  repoUrl: string;
  /** "owner/repo" for GitHub, the file name for a zip. */
  repoName: string;
  branch: string | null;
  commit: string | null;
  title: string;
  status: VivaStatus;
  error: string | null;
  config: VivaConfig;
  brief: VivaBrief | null;
  messages: VivaMessage[];
  /** 1-based topic the examiner is on; 0 before the first question. */
  topicIndex: number;
  /** The examiner has wrapped up the viva. */
  ended: boolean;
  result: VivaResult | null;
  modelUsed: string | null;
  durationMs: number | null;
  createdAt: number;
  startedAt: number;
  completedAt: number | null;
}

export const MODEL_PRESETS:{ value: string; label: string; hint: string }[] = [
  { value: "sonnet", label: "Sonnet (latest)", hint: "Balanced quality and speed. Good default" },
  { value: "opus", label: "Opus (latest)", hint: "Deep reasoning, best for hard material" },
  { value: "fable", label: "Fable (latest)", hint: "Anthropic's newest family" },
  { value: "haiku", label: "Haiku (latest)", hint: "Fastest, uses the least of your limits" },
];
