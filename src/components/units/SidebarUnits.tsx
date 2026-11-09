"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Plus } from "lucide-react";
import { cx } from "../ui";
import { CreateUnitForm } from "./CreateUnitForm";
import { useUnits } from "./useUnits";

/** The side panel's list of units, with an inline form to add one. */
export function SidebarUnits() {
  return (
    <Suspense fallback={<List pathname={null} />}>
      <WithPath />
    </Suspense>
  );
}

function WithPath() {
  return <List pathname={usePathname()} />;
}

function List({ pathname }: { pathname: string | null }) {
  const router = useRouter();
  const { units } = useUnits();
  const [creating, setCreating] = useState(false);

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between px-2.5 pb-1.5">
        <span className="text-xs text-subtle">Units</span>
        <button
          type="button"
          onClick={() => setCreating((c) => !c)}
          aria-expanded={creating}
          aria-label="New unit"
          title="New unit"
          className="-mr-1 grid size-6 place-items-center rounded text-subtle transition-colors hover:bg-zinc-100 hover:text-foreground pointer-coarse:size-9 dark:hover:bg-zinc-900"
        >
          <Plus className={cx("size-3.5 transition-transform duration-200", creating && "rotate-45")} />
        </button>
      </div>

      {creating && (
        <div className="mb-2 px-0.5">
          <CreateUnitForm
            compact
            onCancel={() => setCreating(false)}
            onCreated={(u) => {
              setCreating(false);
              router.push(`/units/${u.id}`);
            }}
          />
        </div>
      )}

      {units === null ? (
        <div className="space-y-1.5 px-2.5 pt-1" aria-hidden>
          <div className="h-4 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-4 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
        </div>
      ) : units.length === 0 ? (
        !creating && <p className="px-2.5 text-xs leading-relaxed text-subtle">No units yet. Add one to start uploading.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {units.map((u) => {
            const active = pathname === `/units/${u.id}`;
            return (
              <li key={u.id}>
                <Link
                  href={`/units/${u.id}`}
                  aria-current={active ? "page" : undefined}
                  title={u.code ? `${u.code} · ${u.name}` : u.name}
                  className={cx(
                    "relative flex min-h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150 pointer-coarse:min-h-10",
                    active ? "bg-zinc-100 font-medium text-foreground dark:bg-zinc-900" : "text-muted hover:bg-sunken hover:text-foreground",
                  )}
                >
                  {active && (
                    <span aria-hidden className="animate-pop-in absolute top-1/2 -left-3 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground" />
                  )}
                  <span
                    aria-hidden
                    className={cx("size-1.5 shrink-0 rounded-full", active ? "bg-foreground" : "bg-line-strong")}
                  />
                  <span className="min-w-0 flex-1 truncate">{u.name}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-subtle">{u.documentCount}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
