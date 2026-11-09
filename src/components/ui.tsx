import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** A flat panel with a hairline border. `interactive` adds the hover state for linked cards. */
export function Card({ className, interactive, ...props }: ComponentProps<"div"> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "surface rounded-xl",
        interactive &&
          "transition-[border-color,background-color] duration-200 hover:border-line-strong hover:bg-sunken",
        className,
      )}
      {...props}
    />
  );
}

const buttonVariants = {
  // Solid ink: black on light, white on dark.
  primary: "bg-foreground text-background hover:opacity-85 disabled:opacity-40 disabled:hover:opacity-40",
  secondary:
    "border border-line-strong bg-surface text-foreground hover:bg-zinc-100 disabled:opacity-50 dark:hover:bg-zinc-900",
  ghost: "text-muted hover:bg-zinc-100 hover:text-foreground disabled:opacity-50 dark:hover:bg-zinc-900",
  danger: "text-red-600 hover:bg-red-500/10 dark:text-red-400",
  "danger-solid": "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50",
};

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cx(
    "inline-flex min-h-9 select-none items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-[color,background-color,border-color,opacity,transform] duration-150 ease-(--ease-out-quart) active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 pointer-coarse:min-h-11",
    buttonVariants[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}

export type Tone = "zinc" | "brand" | "green" | "amber" | "red";

/* Neutral badges are outlined; "brand" is solid ink. Colour only for grading states. */
const BADGE_TONES: Record<Tone, string> = {
  zinc: "border-line-strong text-muted",
  brand: "border-transparent bg-foreground text-background",
  green: "border-emerald-600/25 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-400",
  amber: "border-amber-600/30 text-amber-700 dark:border-amber-400/25 dark:text-amber-400",
  red: "border-red-600/25 text-red-700 dark:border-red-400/25 dark:text-red-400",
};

export function Badge({
  tone = "zinc",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-xs font-medium",
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Tone for a score as a fraction (0-1). */
export const scoreTone = (fraction: number): Tone =>
  fraction >= 0.8 ? "green" : fraction >= 0.5 ? "amber" : "red";

/**
 * Stroke/text colour class for a score, for rings and bars. Scores are drawn in
 * ink, and the number beside them carries the meaning.
 */
export const scoreColor = (fraction: number) => (fraction > 0 ? "text-foreground" : "text-subtle");

/**
 * A segmented control. Each option is a toggle button (aria-pressed) in a
 * labelled group, so Tab moves between options and no arrow-key contract is implied.
 */
export function ToggleGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  size = "md",
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; aria?: string; title?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex flex-wrap gap-0.5 rounded-lg border border-line p-0.5 text-sm"
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.aria}
            title={o.title ?? o.aria}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center justify-center rounded-md font-medium transition-[color,background-color] duration-150",
              size === "sm" ? "h-7 min-w-7 px-2 pointer-coarse:h-10 pointer-coarse:min-w-10" : "h-8 px-3 pointer-coarse:h-10",
              on ? "bg-foreground text-background" : "text-muted hover:bg-zinc-100 hover:text-foreground dark:hover:bg-zinc-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-subtle hover:border-zinc-400 focus:border-foreground focus:ring-3 focus:ring-foreground/10 dark:hover:border-zinc-600";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-[1.5px] border-current border-r-transparent",
        className,
      )}
    />
  );
}

/** Skeleton shown while a page's data streams in. */
export function PageLoading() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="h-8 w-56 max-w-full animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-4 w-96 max-w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-900" />
      <div className="grid gap-3 pt-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-line bg-sunken" />
        ))}
      </div>
    </div>
  );
}

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cx(
        "inline-grid h-5 min-w-5 place-items-center rounded border border-line-strong px-1 font-mono text-[11px] leading-none text-subtle",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Small label above a heading or section. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("font-mono text-xs text-subtle", className)}>{children}</div>;
}

export function SectionTitle({ children, action, count }: { children: ReactNode; action?: ReactNode; count?: number }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-3 border-b border-line pb-3">
      <h2 className="flex items-baseline gap-2 text-sm font-semibold">
        {children}
        {count !== undefined && <span className="font-mono text-xs font-normal tabular-nums text-subtle">{count}</span>}
      </h2>
      {action}
    </div>
  );
}

/** The heading block at the top of a page: an eyebrow, a title, a description and actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  icon,
  meta,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  icon?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="animate-fade-up">
      {back && <BackLink href={back.href}>{back.label}</BackLink>}
      <div className={cx("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", back && "mt-6")}>
        <div className="flex min-w-[min(100%,22rem)] flex-1 gap-4">
          {icon}
          <div className="min-w-0 flex-1">
            {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
            {typeof title === "string" ? (
              <h1 className="font-display text-3xl leading-[1.1] sm:text-4xl">{title}</h1>
            ) : (
              title
            )}
            {description && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">{description}</p>}
            {meta && <div className="mt-4">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** A square holding an icon, used beside titles and in list rows. Always neutral. */
export function IconTile({
  children,
  size = "md",
  className,
}: {
  children: ReactNode;
  /** Kept for callers; every tone renders the same neutral tile. */
  tone?: "brand" | "rose" | "zinc" | "amber" | "green";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-9 rounded-md", md: "size-10 rounded-lg", lg: "size-12 rounded-lg" };
  return (
    <span
      aria-hidden
      className={cx("grid shrink-0 place-items-center border border-line bg-sunken text-foreground", sizes[size], className)}
    >
      {children}
    </span>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group -ml-1 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-md px-1 text-sm text-muted transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />{" "}
      <span className="truncate">{children}</span>
    </Link>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <span className="grid size-11 place-items-center rounded-lg border border-line bg-surface text-foreground">
        {icon}
      </span>
      <div>
        <div className="text-base font-semibold tracking-tight">{title}</div>
        {children && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="animate-fade-up rounded-md border border-red-600/25 bg-red-500/[0.05] px-3 py-2.5 text-sm text-red-700 dark:border-red-400/25 dark:text-red-400"
    >
      {children}
    </p>
  );
}

/** A thin progress meter. `value` is a fraction from 0 to 1. */
export function Meter({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cx("h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900", className)}>
      <div
        className={cx("animate-grow-x h-full rounded-full", barClassName ?? "bg-foreground")}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}
