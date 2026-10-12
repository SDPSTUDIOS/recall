import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

const buttonVariants = {
  // Hovers go darker: white on the 500 shades falls below 4.5:1.
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50 shadow-sm shadow-brand-600/20",
  secondary:
    "border border-zinc-300 bg-white text-zinc-800 hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800",
  ghost: "text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-zinc-800",
  danger:
    "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50",
  "danger-solid": "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50 shadow-sm",
};

export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cx(
    "inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 pointer-coarse:min-h-11",
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

export function Badge({
  tone = "zinc",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tones[tone],
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
      className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm dark:border-zinc-800 dark:bg-zinc-900"
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
              "inline-flex items-center justify-center rounded-md font-medium transition-colors",
              size === "sm" ? "h-7 min-w-7 px-2 pointer-coarse:h-10 pointer-coarse:min-w-10" : "h-8 px-3 pointer-coarse:h-10",
              on
                ? "bg-brand-600 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100",
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
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-zinc-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-950";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}

export function PageLoading() {
  return (
    <div className="flex justify-center py-20 text-subtle">
      <Spinner className="size-6" />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid min-w-5 place-items-center rounded border border-zinc-300 bg-zinc-50 px-1 font-mono text-[11px] leading-4 text-zinc-600 shadow-[0_1px_0] shadow-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:shadow-zinc-700">
      {children}
    </kbd>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group -ml-1 inline-flex min-h-8 max-w-full items-center gap-1 rounded-md px-1 text-sm text-muted transition-colors hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      <ArrowLeft className="size-4 shrink-0 transition-transform group-hover:-translate-x-0.5" /> <span className="truncate">{children}</span>
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
    <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        {icon}
      </span>
      <div>
        <div className="font-medium">{title}</div>
        {children && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{children}</p>}
      </div>
      {action}
    </Card>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300"
    >
      {children}
    </p>
  );
}
