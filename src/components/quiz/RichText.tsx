"use client";

import katex from "katex";
import "katex/dist/katex.min.css";
import { useMemo } from "react";

type Segment = { tex: null; text: string } | { tex: string; display: boolean };

// \[...\] and $$...$$ display; \(...\) inline. A single $ is left alone: in
// study material it is far more often money than maths.
const MATH = /\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\\\(([\s\S]+?)\\\)/g;

export function splitMath(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(MATH)) {
    if (m.index > last) out.push({ tex: null, text: text.slice(last, m.index) });
    const display = m[3] === undefined;
    out.push({ tex: (m[1] ?? m[2] ?? m[3]).trim(), display });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ tex: null, text: text.slice(last) });
  return out;
}

export const hasMath = (text: string) => /\\\[|\\\(|\$\$/.test(text);

export function renderTex(tex: string, display: boolean): string {
  return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: "ignore", output: "htmlAndMathml" });
}

export function Tex({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => renderTex(tex, display), [tex, display]);
  return (
    <span
      className={display ? `block overflow-x-auto overflow-y-hidden py-1 ${className ?? ""}` : className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** Plain text with any LaTeX in it rendered. Keeps line breaks when the parent uses whitespace-pre-wrap. */
export function RichText({ text }: { text: string }) {
  const segments = useMemo(() => splitMath(text), [text]);
  if (segments.length === 1 && segments[0].tex === null) return <>{text}</>;
  return (
    <>
      {segments.map((s, i) =>
        s.tex === null ? <span key={i}>{s.text}</span> : <Tex key={i} tex={s.tex} display={s.display} />,
      )}
    </>
  );
}
