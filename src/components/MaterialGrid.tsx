import Link from "next/link";
import { ArrowUpRight, FileText } from "lucide-react";
import { formatRelative, isLowText } from "@/lib/format";
import type { DocumentRecord } from "@/lib/types";
import { Badge } from "./ui";

/** Lecture materials as bordered tiles: name, pages, sets and upload date. */
export function MaterialGrid({ documents }: { documents: (DocumentRecord & { quizCount: number })[] }) {
  return (
    <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((d, i) => (
        <li key={d.id} style={{ "--i": i } as React.CSSProperties}>
          <Link
            href={`/documents/${d.id}`}
            className="group flex h-full items-start gap-3.5 rounded-xl border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
          >
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-md border border-line text-subtle transition-colors group-hover:border-line-strong group-hover:text-foreground"
            >
              <FileText className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium" title={d.name}>
                {d.name}
              </div>
              <div className="mt-0.5 text-[13px] text-subtle">
                {d.pageCount} pages ·{" "}
                {d.quizCount === 0 ? "no sets yet" : `${d.quizCount} ${d.quizCount === 1 ? "set" : "sets"}`}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className="font-mono text-[11px] text-subtle">{formatRelative(d.createdAt)}</span>
                {isLowText(d) && <Badge tone="amber">Scanned</Badge>}
              </div>
            </div>
            <ArrowUpRight className="size-4 shrink-0 text-subtle opacity-0 transition-[opacity,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
