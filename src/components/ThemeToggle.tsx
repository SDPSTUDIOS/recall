"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_KEY as KEY } from "@/lib/theme";
import { cx } from "./ui";

export type Theme = "system" | "light" | "dark";

const EVENT = "recall:theme";

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Applies and saves a theme, and tells every toggle on the page (used by the command palette too). */
export function setTheme(t: Theme) {
  apply(t);
  try {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent<Theme>(EVENT, { detail: t }));
}

const OPTIONS = [
  { value: "system", icon: Monitor, label: "System theme" },
  { value: "light", icon: Sun, label: "Light theme" },
  { value: "dark", icon: Moon, label: "Dark theme" },
] as const;

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    let saved: Theme = "system";
    try {
      const v = localStorage.getItem(KEY);
      if (v === "light" || v === "dark") saved = v;
    } catch {
      /* ignore */
    }
    // Read after mount so the server render matches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(saved);
    const onTheme = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, onTheme);
    return () => window.removeEventListener(EVENT, onTheme);
  }, []);

  // Follow the system while "system" is selected.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const index = OPTIONS.findIndex((o) => o.value === theme);

  return (
    <div
      role="group"
      aria-label="Theme"
      className="relative grid grid-cols-3 rounded-full border border-line p-0.5"
    >
      {/* The selected option's pill slides between positions. */}
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-4px)/3)] rounded-full bg-zinc-100 transition-transform duration-300 ease-(--ease-out-expo) dark:bg-zinc-800"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          aria-label={label}
          title={label}
          onClick={() => {
            setThemeState(value);
            setTheme(value);
          }}
          className={cx(
            "relative grid size-7 place-items-center rounded-full transition-colors pointer-coarse:size-10",
            theme === value ? "text-foreground" : "text-subtle hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
