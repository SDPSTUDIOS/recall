"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, FileArchive, GitBranch, GraduationCap, X } from "lucide-react";
import { MODEL_PRESETS, type Effort, type VivaConfig, type VivaSource } from "@/lib/types";
import { useClaudeStatus } from "../useClaudeStatus";
import { Button, Card, ErrorText, Spinner, ToggleGroup, cx, inputClass } from "../ui";
import { GitHubSignIn } from "./GitHubSignIn";

const PREFS_KEY = "exam-helper:viva-prefs";

type Prefs = Pick<VivaConfig, "model" | "effort" | "topicCount" | "difficulty">;

const DEFAULT_PREFS: Prefs = { model: "sonnet", effort: "default", topicCount: 6, difficulty: "mixed" };

const LENGTHS = [
  { value: "4", label: "Short · 4" },
  { value: "6", label: "Standard · 6" },
  { value: "8", label: "Long · 8" },
  { value: "10", label: "Thorough · 10" },
];

/** Matches MAX_ZIP_BYTES on the server. */
const MAX_ZIP_MB = 100;

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
  { value: "max", label: "Max" },
];

export function NewVivaForm() {
  const router = useRouter();
  const { status } = useClaudeStatus();
  const [source, setSource] = useState<VivaSource>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [zip, setZip] = useState<File | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [customModel, setCustomModel] = useState(false);
  const [focus, setFocus] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The repository needs a GitHub sign-in: its name, for the sign-in panel. */
  const [signIn, setSignIn] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);

  // Restore the last-used settings (per-browser convenience only).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "null");
      if (saved) {
        const merged = { ...DEFAULT_PREFS, ...saved };
        // Restored after mount (not in the initial state) so the server render matches.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrefs(merged);
        setCustomModel(!MODEL_PRESETS.some((m) => m.value === merged.model));
      }
    } catch {
      /* ignore */
    }
  }, []);

  const update = (patch: Partial<Prefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const notConnected = status !== null && !status.loggedIn;

  function request(githubToken?: string) {
    if (source === "zip" && zip) {
      const form = new FormData();
      form.append("file", zip);
      for (const [k, v] of Object.entries({ ...prefs, focus, title })) form.append(k, String(v));
      return fetch("/api/vivas", { method: "POST", body: form });
    }
    return fetch("/api/vivas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl, ...prefs, focus, title, githubToken }),
    });
  }

  /** `githubToken` comes from the sign-in panel and lives only for this request. */
  async function submit(githubToken?: string) {
    setBusy(true);
    setError(null);
    setSignInError(null);
    try {
      const res = await request(githubToken);
      const json = await res.json();
      if (!res.ok) {
        if (json.needsAuth) {
          setSignIn(json.repoName ?? "this repository");
          return;
        }
        if (githubToken) {
          setSignInError(json.error ?? "Couldn't fetch the repository with that sign-in.");
          return;
        }
        throw new Error(json.error ?? "Couldn't start the viva.");
      }
      router.push(`/vivas/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      // Routes stay mounted (hidden) after navigation, so reset for when the user comes back.
      setBusy(false);
    }
  }

  return (
    <Card className="animate-fade-up overflow-hidden">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="space-y-7 p-5 sm:p-7">
          <fieldset className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <legend className="text-[15px] font-semibold tracking-tight">Project</legend>
              <ToggleGroup
                label="Where the code is"
                size="sm"
                value={source}
                onChange={(v) => {
                  setSource(v);
                  setSignIn(null);
                  setError(null);
                }}
                options={[
                  {
                    value: "github",
                    label: (
                      <>
                        <GitBranch className="mr-1.5 size-3.5" /> GitHub
                      </>
                    ),
                  },
                  {
                    value: "zip",
                    label: (
                      <>
                        <FileArchive className="mr-1.5 size-3.5" /> Zip file
                      </>
                    ),
                  },
                ]}
              />
            </div>

            {source === "github" ? (
              <label className="block space-y-2">
                <span className="sr-only">GitHub repository link</span>
                <div className="relative">
                  <GitBranch className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-subtle" aria-hidden />
                  <input
                    className={cx(inputClass, "py-3 pl-11 font-mono text-[15px]")}
                    placeholder="https://github.com/owner/repo"
                    value={repoUrl}
                    onChange={(e) => {
                      setRepoUrl(e.target.value);
                      setSignIn(null);
                    }}
                    required
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
                <span className="block text-xs text-muted">
                  Public or private: for a private repository you&apos;ll be asked to sign in to GitHub, just for that
                  download. Link to <code>/tree/branch-name</code> to use a branch other than the default.
                </span>
              </label>
            ) : (
              <ZipPicker
                file={zip}
                onChange={(f) => {
                  setZip(f);
                  setError(null);
                }}
                onError={setError}
              />
            )}
          </fieldset>

          {signIn && (
            <GitHubSignIn
              repoName={signIn}
              busy={busy}
              error={signInError}
              onToken={(t) => submit(t)}
              onCancel={() => {
                setSignIn(null);
                setSignInError(null);
              }}
            />
          )}

          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold tracking-tight">Length</legend>
            <ToggleGroup
              label="Number of topics"
              value={String(prefs.topicCount)}
              onChange={(v) => update({ topicCount: Number(v) })}
              options={LENGTHS}
            />
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold tracking-tight">Difficulty</legend>
            <ToggleGroup
              label="Difficulty"
              value={prefs.difficulty}
              onChange={(d) => update({ difficulty: d })}
              options={[
                { value: "easy", label: "Easy" },
                { value: "medium", label: "Medium" },
                { value: "hard", label: "Hard" },
                { value: "mixed", label: "Mixed" },
              ]}
            />
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-[15px] font-semibold tracking-tight">Claude model</legend>
            {customModel ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={cx(inputClass, "max-w-64 py-1.5 font-mono")}
                  placeholder="e.g. claude-opus-5-5"
                  value={prefs.model}
                  onChange={(e) => update({ model: e.target.value.trim() })}
                  aria-label="Model ID"
                  required
                />
                <button
                  type="button"
                  className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setCustomModel(false);
                    update({ model: "sonnet" });
                  }}
                >
                  Use a preset
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <ToggleGroup
                  label="Claude model"
                  value={prefs.model}
                  onChange={(m) => update({ model: m })}
                  options={MODEL_PRESETS.map((m) => ({ value: m.value, label: m.label.replace(" (latest)", ""), title: m.hint }))}
                />
                <button
                  type="button"
                  className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                  onClick={() => {
                    setCustomModel(true);
                    update({ model: "" });
                  }}
                >
                  Use a specific model ID
                </button>
              </div>
            )}
          </fieldset>

          <details className="group rounded-lg ring-1 ring-inset ring-line">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-4 py-3 text-sm font-medium select-none transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden">
              More options
              <span className="flex items-center gap-2 text-xs font-normal text-muted">
                Focus, effort, title
                <ChevronDown className="size-4 transition-transform duration-300 group-open:rotate-180" />
              </span>
            </summary>
            <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium">Focus areas</span>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="e.g. the database layer, authentication, testing strategy"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Title</span>
                <input
                  className={inputClass}
                  placeholder="The repository name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Preparation effort</span>
                <select
                  className={inputClass}
                  value={prefs.effort}
                  onChange={(e) => update({ effort: e.target.value as Effort })}
                >
                  {EFFORTS.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-muted">How hard Claude thinks while reading the code. Higher is slower.</span>
              </label>
            </div>
          </details>

          {error && <ErrorText>{error}</ErrorText>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken px-5 py-3.5 sm:px-7">
          <span className="text-sm text-muted">
            {notConnected ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-4" /> Claude isn&apos;t connected.{" "}
                <Link href="/setup" className="font-medium underline">
                  Set it up
                </Link>
              </span>
            ) : (
              <>
                <span className="font-mono font-semibold text-foreground">{prefs.topicCount}</span> topics
                {" · "}
                {prefs.difficulty === "mixed" ? "mixed difficulty" : prefs.difficulty}
              </>
            )}
          </span>
          <Button
            type="submit"
            disabled={busy || !prefs.model || (source === "github" ? !repoUrl.trim() || signIn !== null : !zip)}
          >
            {busy ? <Spinner /> : <GraduationCap className="size-4" />}
            {busy ? (source === "zip" ? "Uploading…" : "Checking repository…") : "Prepare viva"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Choose or drop a .zip of the project. */
function ZipPicker({
  file,
  onChange,
  onError,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!/\.zip$/i.test(f.name)) return onError("Choose a .zip file.");
    if (f.size > MAX_ZIP_MB * 1024 * 1024) {
      return onError(
        `That zip is ${Math.round(f.size / 1024 / 1024)} MB; the limit is ${MAX_ZIP_MB} MB. Leave out dependencies (node_modules, venv) and build output.`,
      );
    }
    onChange(f);
  };

  if (file) {
    return (
      <div className="animate-fade-up flex items-center gap-3 rounded-lg border border-foreground px-3.5 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-foreground text-background">
          <FileArchive className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{file.name}</div>
          <div className="font-mono text-xs text-muted">{formatSize(file.size)}</div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Remove zip"
          title="Remove"
          className="grid size-8 place-items-center rounded-lg text-subtle hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // Moving onto a child also fires dragleave; only reset when leaving the zone.
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files[0]);
        }}
        className={cx(
          "group flex w-full flex-col items-center gap-2 rounded-lg border-[1.5px] border-dashed px-4 py-8 text-center transition-[background-color,border-color] duration-200",
          dragging
            ? "border-solid border-foreground bg-sunken"
            : "border-line-strong hover:border-zinc-400 hover:bg-sunken dark:hover:border-zinc-600",
        )}
      >
        <span className="grid size-11 place-items-center rounded-full border border-line-strong text-subtle transition-[transform,color] duration-300 group-hover:-translate-y-0.5 group-hover:text-foreground">
          <FileArchive className="size-5" aria-hidden />
        </span>
        <span className="text-sm font-medium">Drop a .zip of your project, or click to choose</span>
        <span className="text-xs text-muted">
          Up to {MAX_ZIP_MB} MB. Dependencies and build output (node_modules, venv, dist…) are skipped, so leaving them
          in is fine.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

const formatSize = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
