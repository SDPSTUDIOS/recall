"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { CircleHelp, GraduationCap, Library, Plus } from "lucide-react";
import { cx } from "./ui";

type Variant = "bar" | "sidebar";

const LINKS = [
  {
    href: "/",
    label: "Library",
    icon: Library,
    match: (p: string) =>
      p === "/" || p.startsWith("/units") || p.startsWith("/documents") || p.startsWith("/quizzes") || p.startsWith("/attempts"),
  },
  { href: "/generate", label: "New set", icon: Plus, match: (p: string) => p.startsWith("/generate") },
  { href: "/vivas", label: "Viva", icon: GraduationCap, match: (p: string) => p.startsWith("/vivas") },
  // Help is also in the footer, the palette and the status pill, so it can drop out of the phone bar.
  { href: "/setup", label: "Help", icon: CircleHelp, match: (p: string) => p.startsWith("/setup"), wide: true },
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
  if (variant === "sidebar") {
    return (
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {LINKS.map(({ href, label, icon: Icon, match }) => {
          const active = pathname !== null && match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "group relative flex min-h-9 items-center gap-3 rounded-md px-2.5 text-sm transition-colors duration-150 pointer-coarse:min-h-10",
                active
                  ? "bg-zinc-100 font-medium text-foreground dark:bg-zinc-900"
                  : "text-muted hover:bg-sunken hover:text-foreground",
              )}
            >
              {/* A short ink bar on the panel's edge marks the current section. */}
              {active && (
                <span aria-hidden className="animate-pop-in absolute top-1/2 -left-3 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-foreground" />
              )}
              <Icon className="size-4 shrink-0" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
              {label}
            </Link>
          );
        })}
      </nav>
    );
  }

  /* Tabs along the phone and tablet top bar. The current section gets a solid underline on the bar's bottom edge. */
  return (
    <nav aria-label="Main" className="flex h-full items-stretch">
      {LINKS.map(({ href, label, icon: Icon, match, wide }) => {
        const active = pathname !== null && match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cx(
              "group relative flex items-center px-0.5 text-sm transition-colors duration-150",
              wide && "hidden md:flex",
              active ? "font-medium text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <span className="flex min-h-9 items-center gap-2 rounded-md px-2.5 transition-colors duration-150 group-hover:bg-zinc-100 pointer-coarse:min-h-10 dark:group-hover:bg-zinc-900">
              <Icon className="size-4 shrink-0 md:hidden" aria-hidden strokeWidth={active ? 2.25 : 1.75} />
              <span className="hidden md:inline" aria-hidden>
                {label}
              </span>
            </span>
            {active && (
              <span aria-hidden className="animate-underline absolute inset-x-2.5 -bottom-px h-0.5 bg-foreground" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
