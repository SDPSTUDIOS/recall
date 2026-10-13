"use client";

import { Check, CheckCircle2, CircleDashed, Flag, MessageCircleQuestion, X, XCircle } from "lucide-react";
import {
  BLANK_TOKEN,
  TYPE_LABEL,
  isWritten,
  type Answer,
  type Artifact,
  type Question,
  type QuestionResult,
} from "@/lib/types";
import { Badge, Card, cx } from "../ui";
import { Chart } from "./Chart";
import { RichText, Tex, hasMath } from "./RichText";

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const LETTERS = "ABCDEFGHIJ";

export function StatusBadge({ result }: { result: QuestionResult }) {
  const map = {
    correct: { tone: "green", icon: <CheckCircle2 className="size-3" />, text: "Correct" },
    partial: { tone: "amber", icon: <CircleDashed className="size-3" />, text: "Partly correct" },
    incorrect: { tone: "red", icon: <XCircle className="size-3" />, text: "Incorrect" },
    unanswered: { tone: "zinc", icon: <CircleDashed className="size-3" />, text: "Not answered" },
    ungraded: { tone: "amber", icon: <CircleDashed className="size-3" />, text: "Not graded" },
  } as const;
  const s = map[result.status];
  return (
    <Badge tone={s.tone}>
      {s.icon} {s.text} · {fmt(result.score)}/{fmt(result.maxScore)}
    </Badge>
  );
}

export function QuestionCard({
  number,
  total,
  question: q,
  answer,
  onChange,
  disabled,
  result,
  reveal,
  flagged,
  onToggleFlag,
  showType = false,
  footer,
  onAskClaude,
  askingClaude,
  hasChat,
}: {
  number: number;
  total?: number;
  question: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  disabled: boolean;
  result?: QuestionResult;
  reveal: boolean;
  flagged?: boolean;
  onToggleFlag?: () => void;
  /** Show the question type (when questions aren't grouped under type headings). */
  showType?: boolean;
  footer?: React.ReactNode;
  /** Opens the Ask Claude panel for this question. */
  onAskClaude?: () => void;
  /** The Ask Claude panel is open on this question. */
  askingClaude?: boolean;
  /** There's a saved conversation about this question. */
  hasChat?: boolean;
}) {
  return (
    <Card
      id={`q-${q.id}`}
      className={cx(
        "scroll-mt-32 p-5 sm:p-6",
        result?.status === "correct" && "border-emerald-300 dark:border-emerald-900",
        (result?.status === "incorrect" || result?.status === "unanswered") && reveal && "border-red-300 dark:border-red-900",
        result?.status === "partial" && "border-amber-300 dark:border-amber-900",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          Question {number}
          {total ? <span className="font-normal text-muted"> of {total}</span> : null}
        </span>
        <span aria-hidden>·</span>
        <span>
          {q.marks} {q.marks === 1 ? "mark" : "marks"}
        </span>
        {showType && <Badge>{TYPE_LABEL[q.type]}</Badge>}
        <Badge>{q.difficulty}</Badge>
        {q.topic && <Badge tone="brand" className="max-w-56 truncate">{q.topic}</Badge>}
        <span className="flex-1" />
        {result && <StatusBadge result={result} />}
        {onAskClaude && (
          <button
            type="button"
            onClick={onAskClaude}
            aria-pressed={askingClaude}
            title={hasChat ? "Continue your conversation with Claude" : "Talk this question through with Claude"}
            className={cx(
              "inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors pointer-coarse:min-h-9",
              askingClaude
                ? "bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
                : "text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/60",
            )}
          >
            <MessageCircleQuestion className="size-3.5" aria-hidden />
            Ask Claude
            {hasChat && (
              <>
                <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                <span className="sr-only">(conversation saved)</span>
              </>
            )}
          </button>
        )}
        {onToggleFlag && !result && (
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            title="Mark for review (M)"
            className={cx(
              "inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 py-1 font-medium transition-colors pointer-coarse:min-h-9",
              flagged
                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                : "text-subtle hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200",
            )}
          >
            <Flag className={cx("size-3", flagged && "fill-current")} />
            {flagged ? "Marked" : "Mark for review"}
          </button>
        )}
      </div>

      {q.type === "fill_blank" ? (
        <FillBlank q={q} answer={answer} onChange={onChange} disabled={disabled} result={result} reveal={reveal} />
      ) : (
        <p className="whitespace-pre-wrap text-base font-medium leading-relaxed">
          <RichText text={q.question} />
        </p>
      )}

      {q.artifact && <ArtifactBlock artifact={q.artifact} />}

      {(q.type === "mcq" || q.type === "single") && (
        <Choices q={q} answer={answer} onChange={onChange} disabled={disabled} reveal={reveal} />
      )}

      {isWritten(q.type) && (
        <div className="mt-4">
          <textarea
            className="min-h-44 w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 text-[15px] leading-relaxed outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-80 dark:border-zinc-700 dark:bg-zinc-950"
            placeholder={
              q.artifact?.kind === "math" || q.artifact?.kind === "chart"
                ? "Write your answer and show your working. Type maths as you would on a calculator, e.g. x^2 + 3x = 0 or sqrt(2)/2…"
                : (q.artifact?.kind ?? "code") === "code" && q.type === "artifact"
                  ? "Write your answer. You can refer to line numbers…"
                  : "Write your answer…"
            }
            aria-label={`Answer to question ${number}`}
            value={answer?.kind === "text" ? answer.text : ""}
            onChange={(e) => onChange({ kind: "text", text: e.target.value })}
            disabled={disabled}
          />
          {answer?.kind === "text" && hasMath(answer.text) && (
            <div className="mt-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-[15px] leading-relaxed dark:border-zinc-700">
              <div className="mb-1 text-xs font-medium text-muted">Preview</div>
              <p className="whitespace-pre-wrap">
                <RichText text={answer.text} />
              </p>
            </div>
          )}
          {!disabled && (
            <div className="mt-1 text-right text-xs tabular-nums text-subtle">
              {wordCount(answer?.kind === "text" ? answer.text : "")} words
            </div>
          )}
        </div>
      )}

      {reveal && <Review q={q} result={result} />}

      {footer && <div className="mt-5">{footer}</div>}
    </Card>
  );
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function Choices({
  q,
  answer,
  onChange,
  disabled,
  reveal,
}: {
  q: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  disabled: boolean;
  reveal: boolean;
}) {
  const selected = answer?.kind === "choice" ? answer.selected : [];
  const multi = q.type === "mcq";

  return (
    <div className="mt-4 space-y-2" role={multi ? "group" : "radiogroup"}>
      {multi && <p className="text-xs text-muted">Select all that apply.</p>}
      {q.options.map((opt, i) => {
        const isSelected = selected.includes(i);
        const isCorrect = q.correctOptions.includes(i);
        return (
          <label
            key={i}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 text-sm transition-[color,background-color,border-color,transform] duration-150 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-brand-500 has-[input:enabled]:active:scale-[0.99]",
              !reveal && isSelected && "border-brand-500 bg-brand-50/60 dark:bg-brand-950/40",
              !reveal && !isSelected && "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50",
              reveal && isCorrect && "border-emerald-400 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40",
              reveal && !isCorrect && isSelected && "border-red-400 bg-red-50 dark:border-red-800 dark:bg-red-950/40",
              reveal && !isCorrect && !isSelected && "border-zinc-200 opacity-70 dark:border-zinc-800",
              disabled && "cursor-default",
            )}
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={q.id}
              className="sr-only"
              checked={isSelected}
              disabled={disabled}
              onChange={() =>
                onChange({
                  kind: "choice",
                  selected: multi
                    ? isSelected
                      ? selected.filter((s) => s !== i)
                      : [...selected, i].sort((a, b) => a - b)
                    : [i],
                })
              }
            />
            <span
              aria-hidden
              className={cx(
                "grid size-6 shrink-0 place-items-center border text-xs font-semibold transition-colors",
                multi ? "rounded-md" : "rounded-full",
                isSelected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-zinc-300 text-muted dark:border-zinc-700",
                reveal && isCorrect && "border-emerald-600 bg-emerald-600 text-white",
                reveal && !isCorrect && isSelected && "border-red-600 bg-red-600 text-white",
              )}
            >
              {LETTERS[i]}
            </span>
            <span className="flex-1 whitespace-pre-wrap pt-0.5">
              <RichText text={opt} />
            </span>
            {reveal && isCorrect && <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
            {reveal && !isCorrect && isSelected && <X className="mt-0.5 size-4 shrink-0 text-red-600" />}
          </label>
        );
      })}
    </div>
  );
}

function FillBlank({
  q,
  answer,
  onChange,
  disabled,
  result,
  reveal,
}: {
  q: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  disabled: boolean;
  result?: QuestionResult;
  reveal: boolean;
}) {
  const parts = q.question.split(BLANK_TOKEN);
  const values = answer?.kind === "blanks" ? answer.values : [];

  return (
    <p className="text-base font-medium leading-loose">
      {parts.map((part, i) => (
        <span key={i}>
          <span className="whitespace-pre-wrap">
            <RichText text={part} />
          </span>
          {i < parts.length - 1 && (
            <span className="inline-flex flex-col align-baseline">
              <input
                aria-label={`Blank ${i + 1}`}
                className={cx(
                  "mx-1 w-40 rounded-md border-b-2 bg-zinc-100 px-2 py-0.5 text-sm font-normal outline-none transition-colors focus:border-brand-500 focus:bg-white focus:ring-2 focus:ring-brand-500/25 dark:bg-zinc-800 dark:focus:bg-zinc-950",
                  !reveal && "border-zinc-400",
                  reveal && result?.blankCorrect?.[i] && "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50",
                  reveal && result?.blankCorrect && !result.blankCorrect[i] && "border-red-500 bg-red-50 dark:bg-red-950/50",
                )}
                value={values[i] ?? ""}
                disabled={disabled}
                onChange={(e) => {
                  const next = q.blanks.map((_, j) => values[j] ?? "");
                  next[i] = e.target.value;
                  onChange({ kind: "blanks", values: next });
                }}
              />
              {reveal && !result?.blankCorrect?.[i] && (
                <span className="mx-1 text-xs font-normal text-emerald-700 dark:text-emerald-400">
                  {q.blanks[i]?.answers.join(" / ")}
                </span>
              )}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

function ArtifactBlock({ artifact }: { artifact: Artifact }) {
  const kind = artifact.kind ?? "code";
  if (kind === "code") return <CodeBlock artifact={artifact} />;

  const caption = artifact.title || { math: "Equations", chart: "Graph", table: "Data", text: "Case" }[kind];
  return (
    <figure className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <figcaption className="border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-muted dark:border-zinc-800 dark:bg-zinc-800/50">
        <RichText text={caption} />
      </figcaption>
      {kind === "math" && (
        <div className="space-y-1 px-4 py-3 text-[17px]">
          {artifact.content.split("\n").map((line, i) => (
            <Tex key={i} tex={line} display />
          ))}
        </div>
      )}
      {kind === "chart" && artifact.chart && (
        <div className="p-3">
          <Chart chart={artifact.chart} title={artifact.title} />
        </div>
      )}
      {kind === "table" && artifact.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                {artifact.table.columns.map((c, i) => (
                  <th key={i} className="px-3 py-2 text-left font-semibold">
                    <RichText text={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artifact.table.rows.map((row, i) => (
                <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 align-top tabular-nums">
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {kind === "text" && (
        <p className="whitespace-pre-wrap border-l-4 border-brand-300 bg-brand-50/40 px-4 py-3 text-[15px] leading-relaxed dark:border-brand-800 dark:bg-brand-950/20">
          <RichText text={artifact.content} />
        </p>
      )}
    </figure>
  );
}

function CodeBlock({ artifact }: { artifact: Artifact }) {
  const lines = artifact.content.split("\n");
  return (
    <figure className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-950 text-zinc-100 dark:border-zinc-800">
      <figcaption className="flex gap-2 border-b border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400">
        {artifact.title && <span className="text-zinc-300">{artifact.title}</span>}
        <span>{artifact.language}</span>
      </figcaption>
      <pre className="overflow-x-auto py-3 font-mono text-[13px] leading-relaxed">
        <code className="table min-w-full">
          {lines.map((line, i) => (
            <span key={i} className="table-row">
              <span className="table-cell select-none pl-3 pr-4 text-right tabular-nums text-zinc-500">{i + 1}</span>
              <span className="table-cell whitespace-pre pr-4">{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

function Review({ q, result }: { q: Question; result?: QuestionResult }) {
  return (
    <div className="animate-fade-up mt-4 space-y-3 rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-800/50">
      {result?.feedback && (
        <div>
          <div className="mb-1 font-medium">Claude&apos;s feedback</div>
          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            <RichText text={result.feedback} />
          </p>
        </div>
      )}
      {isWritten(q.type) && (result?.coveredPoints?.length || result?.missedPoints?.length) ? (
        <ul className="space-y-1">
          {result.coveredPoints?.map((p, i) => (
            <li key={`c${i}`} className="flex gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="mt-0.5 size-4 shrink-0" /> <span><RichText text={p} /></span>
            </li>
          ))}
          {result.missedPoints?.map((p, i) => (
            <li key={`m${i}`} className="flex gap-2 text-red-700 dark:text-red-400">
              <X className="mt-0.5 size-4 shrink-0" /> <span><RichText text={p} /></span>
            </li>
          ))}
        </ul>
      ) : null}
      {isWritten(q.type) && (
        <details open={!result}>
          <summary className="cursor-pointer font-medium">Model answer and marking points</summary>
          <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            <RichText text={q.modelAnswer} />
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600 dark:text-zinc-400">
            {q.keyPoints.map((p, i) => (
              <li key={i}>
                <RichText text={p} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {q.explanation && (
        <div>
          <div className="mb-1 font-medium">Explanation</div>
          <p className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            <RichText text={q.explanation} />
          </p>
        </div>
      )}
      {q.source && <div className="text-xs text-muted">Source: {q.source}</div>}
    </div>
  );
}
