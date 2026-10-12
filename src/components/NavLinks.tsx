"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Library, Sparkles } from "lucide-react";
import { cx } from "./ui";

const LINKS = [
  {
    href: "/",
    label: "Library",
    icon: Library,
    match: (p: string) =>
      p === "/" || p.startsWith("/documents") || p.startsWith("/quizzes") || p.startsWith("/attempts"),
  },
  { href: "/generate", label: "New set", icon: Sparkles, match: (p: string) => p.startsWith("/generate") },
];

/** The pathname is request data, so the links render without highlighting until it streams in. */
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex items-center gap-1">
      {LINKS.map(({ href, label, icon: Icon, match }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors pointer-coarse:min-h-10",
              active
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/70 dark:text-brand-200"
                : "text-muted hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100",
            )}
          >
            <Icon className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
