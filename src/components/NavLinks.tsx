"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { CircleHelp, Library, Sparkles } from "lucide-react";
import { cx } from "./ui";

type Variant = "bar" | "sidebar";

const LINKS = [
  {
    href: "/",
    label: "Library",
    icon: Library,
    match: (p: string) =>
      p === "/" || p.startsWith("/documents") || p.startsWith("/quizzes") || p.startsWith("/attempts"),
  },
  { href: "/generate", label: "New set", icon: Sparkles, match: (p: string) => p.startsWith("/generate") },
  {
    href: "/setup",
    label: "Setup & help",
    icon: CircleHelp,
    match: (p: string) => p.startsWith("/setup"),
    sidebarOnly: true,
  },
];

/** The pathname is request data, so the links render without highlighting until it streams in. */
export function NavLinks({ variant = "bar" }: { variant?: Variant }) {
  return (
    <Suspense fallback={<Links pathname={null} variant={variant} />}>
      <ActiveLinks variant={variant} />
    </Suspense>
  );
}

function ActiveLinks({ variant }: { variant: Variant }) {
  return <Links pathname={usePathname()} variant={variant} />;
}

function Links({ pathname, variant }: { pathname: string | null; variant: Variant }) {
  const sidebar = variant === "sidebar";
  return (
    <nav aria-label="Main" className={sidebar ? "flex flex-col gap-1" : "flex items-center gap-1"}>
      {LINKS.filter((l) => sidebar || !l.sidebarOnly).map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex items-center rounded-lg text-sm font-medium transition-colors",
              sidebar ? "min-h-10 gap-3 px-3" : "min-h-9 gap-1.5 px-2.5 py-1.5 pointer-coarse:min-h-10",
              active
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-200"
                : "text-muted hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={sidebar ? undefined : "sr-only sm:not-sr-only"}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
