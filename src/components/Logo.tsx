import { cx } from "./ui";

/**
 * The cloud and its trailing bubbles, drawn in currentColor. Shared by the logo
 * and the "Claude is thinking" animation, so the brand and the loading state
 * are the same shape. Keep in sync with src/app/icon.svg (the browser tab icon).
 */
export function ThoughtCloud({ className, thinking }: { className?: string; thinking?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cx(thinking && "thinking", className)} fill="currentColor">
      <circle cx="13.5" cy="14.5" r="4.5" />
      <circle cx="18.5" cy="11" r="5.5" />
      <circle cx="23.5" cy="14.5" r="4" />
      <circle cx="16.5" cy="17.5" r="3.5" />
      <circle cx="21" cy="18" r="3.5" />
      <g className="logo-bubbles">
        <circle className="bubble bubble-2" cx="10" cy="22.8" r="1.9" />
        <circle className="bubble bubble-3" cx="6.6" cy="26.2" r="1.25" />
      </g>
    </svg>
  );
}

/** The Recall mark: a thought cloud, inverted out of a solid tile (black on light, white on dark). */
export function LogoMark({ className, thinking }: { className?: string; thinking?: boolean }) {
  return (
    <span
      aria-hidden
      className={cx(
        "grid shrink-0 place-items-center rounded-[25%] bg-foreground text-background",
        className,
      )}
    >
      <ThoughtCloud className="size-full" thinking={thinking} />
    </span>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className={cx("size-7", markClassName)} />
      Recall
    </span>
  );
}
