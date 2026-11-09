"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleHelp, CornerDownLeft, FileText, FolderOpen, GitBranch, GraduationCap, Library, ListChecks, Monitor, Moon, Search, Sparkles, Sun, Upload } from "lucide-react";
import type { SearchItem } from "@/app/api/search/route";
import { setTheme } from "./ThemeToggle";
import { Kbd, cx } from "./ui";

const OPEN_EVENT = "recall:palette";

/** Opens the command palette from anywhere (the sidebar search button, the mobile header). */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

interface Command {
  id: string;
  group: string;
  label: string;
  detail?: string;
  icon: ReactNode;
  keywords?: string;
  run: () => void;
}

const ICON = "size-4";

/**
 * ⌘K / Ctrl+K: jump to any material, question set or viva, start something new,
 * or switch theme. Built on <dialog> so focus trapping and Escape come free.
 */
export function CommandPalette() {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [items, setItems] = useState<SearchItem[] | null>(null);

  // Global shortcut, plus the event the trigger buttons send.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      setQuery("");
      setActive(0);
      // Fresh each time, so new uploads and sets show up.
      fetch("/api/search", { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { items: SearchItem[] }) => setItems(j.items))
        .catch(() => setItems([]));
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    if (!open && el.open) el.close();
  }, [open]);

  const go = (href: string) => () => router.push(href);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "nav-library", group: "Go to", label: "Library", icon: <Library className={ICON} />, keywords: "home materials sets", run: go("/") },
      { id: "nav-generate", group: "Go to", label: "New question set", icon: <Sparkles className={ICON} />, keywords: "generate create quiz exam combine", run: go("/generate") },
      { id: "nav-upload", group: "Go to", label: "Upload lecture PDFs", icon: <Upload className={ICON} />, keywords: "add pdf file unit", run: go("/") },
      { id: "nav-viva", group: "Go to", label: "Viva practice", icon: <GraduationCap className={ICON} />, keywords: "code github repository oral", run: go("/vivas") },
      { id: "nav-setup", group: "Go to", label: "Setup & help", icon: <CircleHelp className={ICON} />, keywords: "claude connect faq", run: go("/setup") },
    ];
    const content: Command[] = (items ?? []).map((it) => ({
      id: `${it.kind}-${it.id}`,
      group: it.kind === "unit" ? "Units" : it.kind === "quiz" ? "Question sets" : it.kind === "document" ? "Materials" : "Vivas",
      label: it.title,
      detail: it.detail,
      icon:
        it.kind === "unit" ? (
          <FolderOpen className={ICON} />
        ) : it.kind === "quiz" ? (
          <ListChecks className={ICON} />
        ) : it.kind === "document" ? (
          <FileText className={ICON} />
        ) : (
          <GitBranch className={ICON} />
        ),
      run: go(it.href),
    }));
    const theme: Command[] = [
      { id: "theme-light", group: "Theme", label: "Light theme", icon: <Sun className={ICON} />, keywords: "appearance mode", run: () => setTheme("light") },
      { id: "theme-dark", group: "Theme", label: "Dark theme", icon: <Moon className={ICON} />, keywords: "appearance mode night", run: () => setTheme("dark") },
      { id: "theme-system", group: "Theme", label: "Match system theme", icon: <Monitor className={ICON} />, keywords: "appearance mode auto", run: () => setTheme("system") },
    ];
    return [...nav, ...content, ...theme];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const results = useMemo(() => {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      // Without a query: shortcuts, the latest few of each, and theme.
      const counts: Record<string, number> = {};
      return commands.filter((c) => {
        counts[c.group] = (counts[c.group] ?? 0) + 1;
        return c.group === "Go to" || c.group === "Theme" || counts[c.group] <= 4;
      });
    }
    return commands
      .map((c) => {
        const hay = `${c.label} ${c.detail ?? ""} ${c.keywords ?? ""} ${c.group}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return null;
        const label = c.label.toLowerCase();
        // Prefer matches at the start of the name, then anywhere in it.
        const score = label.startsWith(terms[0]) ? 0 : label.includes(terms[0]) ? 1 : 2;
        return { c, score };
      })
      .filter((x): x is { c: Command; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .map((x) => x.c);
  }, [commands, query]);

  // Keep groups together, in the order they first appear.
  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of results) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [results]);
  const flat = groups.flatMap(([, cs]) => cs);
  const activeIndex = Math.min(active, Math.max(0, flat.length - 1));
  const activeId = flat[activeIndex]?.id;

  useEffect(() => {
    if (!activeId) return;
    listRef.current?.querySelector(`[data-id="${CSS.escape(activeId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    setOpen(false);
    c.run();
  };

  return (
    <dialog
      ref={ref}
      onClose={() => setOpen(false)}
      onClick={(e) => e.target === ref.current && setOpen(false)}
      aria-label="Command palette"
      className="surface mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-lg p-0 text-(--foreground) shadow-[0_24px_64px_-16px_rgb(0_0_0/0.3)] dark:border-line-strong dark:shadow-none"
    >
      {open && (
        <div className="flex max-h-[min(36rem,70vh)] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search className="size-[18px] shrink-0 text-subtle" aria-hidden />
            <input
              ref={inputRef}
              role="combobox"
              aria-expanded
              aria-controls="palette-list"
              aria-activedescendant={activeId ? `palette-${activeId}` : undefined}
              aria-label="Search Recall"
              placeholder="Search materials, sets and vivas, or jump to…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") setActive((i) => Math.min(i + 1, flat.length - 1));
                else if (e.key === "ArrowUp") setActive((i) => Math.max(i - 1, 0));
                else if (e.key === "Enter") run(flat[activeIndex]);
                else return;
                e.preventDefault();
              }}
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle"
            />
            <Kbd>Esc</Kbd>
          </div>

          <div ref={listRef} id="palette-list" role="listbox" aria-label="Results" className="flex-1 overflow-y-auto p-2">
            {flat.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted">
                {items === null ? "Loading your library…" : `Nothing matches “${query}”.`}
              </p>
            ) : (
              groups.map(([group, cs]) => (
                <div key={group} role="group" aria-label={group} className="pb-1">
                  <div className="px-2.5 pb-1 pt-3 text-xs font-medium text-subtle">
                    {group}
                  </div>
                  {cs.map((c) => {
                    const on = c.id === activeId;
                    return (
                      <div
                        key={c.id}
                        id={`palette-${c.id}`}
                        data-id={c.id}
                        role="option"
                        aria-selected={on}
                        onPointerMove={() => setActive(flat.indexOf(c))}
                        onClick={() => run(c)}
                        className={cx(
                          "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors duration-100",
                          on ? "bg-zinc-100 text-foreground dark:bg-zinc-900" : "text-muted",
                        )}
                      >
                        <span
                          className={cx(
                            "grid size-7 shrink-0 place-items-center rounded-md border transition-colors",
                            on ? "border-line-strong bg-surface text-foreground" : "border-line text-subtle",
                          )}
                          aria-hidden
                        >
                          {c.icon}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                        {c.detail && <span className="hidden shrink-0 text-xs text-subtle sm:inline">{c.detail}</span>}
                        <CornerDownLeft
                          className={cx("size-3.5 shrink-0 text-subtle transition-opacity", on ? "opacity-100" : "opacity-0")}
                          aria-hidden
                        />
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-xs text-subtle">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↵</Kbd> open
            </span>
            <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
              <Kbd>Esc</Kbd> close
            </span>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Opens the palette: a full search field in the sidebar, or an icon button (`compact`) in the phone and tablet top bar. */
export function CommandTrigger({ compact = false }: { compact?: boolean }) {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    // Platform is only known in the browser.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  if (compact) {
    return (
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label="Search"
        title="Search"
        className="grid size-9 place-items-center rounded-md text-muted transition-colors hover:bg-zinc-100 hover:text-foreground pointer-coarse:size-10 dark:hover:bg-zinc-900"
      >
        <Search className="size-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Search"
      className="group flex h-9 w-full items-center gap-2 rounded-md border border-line px-2.5 text-sm text-subtle transition-colors hover:border-line-strong hover:text-foreground pointer-coarse:h-10"
    >
      <Search className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 text-left">Search…</span>
      <span className="flex items-center gap-0.5" aria-hidden>
        <Kbd>{mac ? "⌘" : "Ctrl"}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
