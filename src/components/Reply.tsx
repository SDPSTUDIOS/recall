import { RichText } from "./quiz/RichText";

/** Claude's reply: paragraphs with maths rendered, and ``` fenced code as blocks. */
export function Reply({ text }: { text: string }) {
  const parts = text.split(/```[^\n]*\n?/);
  return (
    <div className="space-y-2">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-zinc-950 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-100 ring-1 ring-zinc-800">
            {part.replace(/\n$/, "")}
          </pre>
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap">
            <RichText text={part.trim()} />
          </p>
        ) : null,
      )}
    </div>
  );
}
