"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import type { UnitSummary } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { CreateUnitForm } from "./CreateUnitForm";

/** Every unit as a tile, plus a tile that turns into the new-unit form. */
export function UnitGrid({ units }: { units: UnitSummary[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  return (
    <ul className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {units.map((u, i) => (
        <li key={u.id} style={{ "--i": i } as React.CSSProperties}>
          <Link
            href={`/units/${u.id}`}
            className="group flex h-full min-h-36 flex-col justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-colors duration-150 hover:border-line-strong hover:bg-sunken"
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {u.code && <div className="mb-1.5 font-mono text-xs text-subtle">{u.code}</div>}
                <div className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight">{u.name}</div>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-subtle opacity-0 transition-[opacity,transform] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground group-hover:opacity-100" />
            </div>
            <dl className="flex items-end gap-5 text-[13px]">
              <Stat label="Materials" value={u.documentCount} />
              <Stat label="Sets" value={u.quizCount} />
              <Stat label="Pages" value={u.pageCount} />
              <span className="ml-auto font-mono text-[11px] text-subtle">{formatRelative(u.createdAt)}</span>
            </dl>
          </Link>
        </li>
      ))}
      <li style={{ "--i": units.length } as React.CSSProperties}>
        {creating ? (
          <div className="h-full rounded-xl border border-line-strong p-4">
            <div className="mb-3 text-sm font-medium">New unit</div>
            <CreateUnitForm
              compact
              onCancel={() => setCreating(false)}
              onCreated={(u) => {
                setCreating(false);
                router.push(`/units/${u.id}`);
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="group flex h-full min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong text-sm text-muted transition-colors hover:border-foreground hover:text-foreground"
          >
            <span className="grid size-9 place-items-center rounded-full border border-line-strong transition-transform duration-300 ease-(--ease-out-expo) group-hover:rotate-90">
              <Plus className="size-4" aria-hidden />
            </span>
            New unit
          </button>
        )}
      </li>
    </ul>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-subtle">{label}</dt>
      <dd className="font-mono text-base font-medium tabular-nums">{value}</dd>
    </div>
  );
}
