import { cx } from "./ui";

/**
 * The Recall mark: a looping arrow around a dot, an idea coming back to mind.
 * Keep in sync with src/app/icon.svg (the browser tab icon).
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cx("shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <g fill="none" stroke="#fff" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 9.6A8 8 0 1 1 10.1 12.6" />
        <path d="M6.9 13.6 10.1 12.6 11.1 15.8" />
      </g>
      <circle cx="17" cy="16.6" r="2.6" fill="#fff" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-bold tracking-tight", className)}>
      <LogoMark className={cx("size-8 drop-shadow-sm", markClassName)} />
      Recall
    </span>
  );
}
