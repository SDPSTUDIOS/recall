import "server-only";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { WORK_DIR } from "./db";

/**
 * Runs the locally installed Claude Code CLI in print mode, so requests are
 * billed to whatever account `claude` is signed into (your Claude subscription).
 */

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Finds the CLI on every call rather than once at startup. The server's PATH is
 * fixed when it starts, so if Claude Code is installed afterwards (the installer
 * only updates PATH for new shells), we also check the usual install locations.
 */
function resolveClaudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const name = process.platform === "win32" ? "claude.exe" : "claude";
  const home = os.homedir();
  const dirs = [
    ...(process.env.PATH ?? "").split(path.delimiter),
    path.join(home, ".local", "bin"),
    path.join(home, ".claude", "local"),
    path.dirname(process.execPath),
    "/opt/homebrew/bin",
    "/usr/local/bin",
  ];
  for (const dir of dirs) {
    if (!dir) continue;
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      if (fs.statSync(candidate).isFile()) return candidate;
    } catch {
      /* not here */
    }
  }
  return "claude";
}

export interface ClaudeRunOptions {
  /** Full user prompt, delivered on stdin (avoids Windows command-line limits). */
  input: string;
  systemPrompt: string;
  model: string;
  effort?: string;
  schema: object;
  /** Built-in tools to enable. Empty = no tools (pure text in, JSON out). */
  tools?: string[];
  cwd?: string;
  timeoutMs?: number;
}

export interface ClaudeRunResult<T> {
  output: T;
  modelUsed: string | null;
  durationMs: number;
}

export class ClaudeError extends Error {}

/** The CLI reads ANTHROPIC_API_KEY ahead of the subscription login, so strip it. */
function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.CLAUDECODE;
  return env;
}

function exec(
  args: string[],
  {
    input,
    cwd,
    timeoutMs,
    onStdout,
    signal,
  }: {
    input?: string;
    cwd?: string;
    timeoutMs: number;
    /** Called with each chunk of stdout as it arrives. */
    onStdout?: (chunk: string) => void;
    /** Kills the process, e.g. when the browser that asked for it goes away. */
    signal?: AbortSignal;
  },
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const bin = resolveClaudeBin();
  return new Promise((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ bin, args, {
      cwd: cwd ?? WORK_DIR,
      env: childEnv(),
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.stdout.setEncoding("utf8").on("data", (d: string) => {
      stdout += d;
      onStdout?.(d);
    });
    const abort = () => child.kill();
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort, { once: true });
    child.stderr.setEncoding("utf8").on("data", (d) => (stderr += d));

    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new ClaudeError(
          err.code === "ENOENT"
            ? `Claude Code CLI not found ("${bin}"). Install Claude Code and sign in by running \`claude\` once, or set CLAUDE_BIN in .env.local to the full path of the executable.`
            : `Could not start Claude Code: ${err.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (timedOut) {
        reject(new ClaudeError(`Claude took longer than ${Math.round(timeoutMs / 60000)} minutes and was stopped.`));
      } else {
        resolve({ stdout, stderr, code });
      }
    });

    child.stdin.on("error", () => {
      /* the process may exit before reading stdin; the close handler reports it */
    });
    child.stdin.end(input ?? "");
  });
}

export async function runClaude<T>(opts: ClaudeRunOptions): Promise<ClaudeRunResult<T>> {
  const tools = opts.tools ?? [];
  // Variadic flags (--tools, --allowedTools) come first, each followed by a
  // regular flag, so they never swallow later arguments.
  const args = ["-p", "--tools", tools.join(",")];
  if (tools.length) args.push("--allowedTools", tools.join(","));
  args.push(
    "--permission-mode", "dontAsk",
    "--output-format", "json",
    "--model", opts.model,
    "--system-prompt", opts.systemPrompt,
    "--json-schema", JSON.stringify(opts.schema),
    "--no-session-persistence",
    "--safe-mode",
    "--strict-mcp-config",
  );
  if (opts.effort && opts.effort !== "default") args.push("--effort", opts.effort);

  const started = Date.now();
  const { stdout, stderr, code } = await exec(args, {
    input: opts.input,
    cwd: opts.cwd,
    timeoutMs: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });

  let parsed: {
    is_error?: boolean;
    subtype?: string;
    result?: string;
    structured_output?: unknown;
    modelUsage?: Record<string, unknown>;
    api_error_status?: number | null;
  };
  try {
    parsed = JSON.parse(stdout.trim());
  } catch {
    const detail = (stderr || stdout).trim().slice(0, 800);
    throw new ClaudeError(
      `Claude Code exited${code !== null ? ` with code ${code}` : ""} without a result.${detail ? ` ${detail}` : ""}`,
    );
  }

  if (parsed.is_error || parsed.subtype !== "success") {
    const msg = parsed.result?.trim() || parsed.subtype || "unknown error";
    throw new ClaudeError(`Claude returned an error: ${msg.slice(0, 800)}`);
  }

  let output = parsed.structured_output;
  if (output === undefined && parsed.result) {
    try {
      output = JSON.parse(parsed.result);
    } catch {
      /* handled below */
    }
  }
  if (output === undefined || output === null) {
    throw new ClaudeError("Claude did not return structured output. Try again or pick another model.");
  }

  return {
    output: output as T,
    modelUsed: Object.keys(parsed.modelUsage ?? {})[0] ?? null,
    durationMs: Date.now() - started,
  };
}

export interface ClaudeStreamOptions {
  input: string;
  systemPrompt: string;
  model: string;
  effort?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Called with each piece of reply text as Claude writes it. */
  onText: (text: string) => void;
}

/** Plain-text reply with no tools, streamed as it's written. Resolves once Claude has finished. */
export async function streamClaude(opts: ClaudeStreamOptions): Promise<void> {
  const args = [
    "-p", "--tools", "",
    "--permission-mode", "dontAsk",
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
    "--model", opts.model,
    "--system-prompt", opts.systemPrompt,
    "--no-session-persistence",
    "--safe-mode",
    "--strict-mcp-config",
  ];
  if (opts.effort && opts.effort !== "default") args.push("--effort", opts.effort);

  // stream-json is one JSON object per line; a chunk can end mid-line.
  let pending = "";
  let result: { is_error?: boolean; subtype?: string; result?: string } | null = null;
  const onLine = (line: string) => {
    if (!line.trim()) return;
    let msg: {
      type?: string;
      event?: { type?: string; delta?: { type?: string; text?: string } };
      is_error?: boolean;
      subtype?: string;
      result?: string;
    };
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const delta = msg.event?.delta;
    if (msg.type === "stream_event" && msg.event?.type === "content_block_delta" && delta?.type === "text_delta" && delta.text) {
      opts.onText(delta.text);
    } else if (msg.type === "result") {
      result = msg;
    }
  };

  const { stdout, stderr, code } = await exec(args, {
    input: opts.input,
    timeoutMs: opts.timeoutMs ?? 5 * 60 * 1000,
    signal: opts.signal,
    onStdout: (chunk) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      lines.forEach(onLine);
    },
  });
  onLine(pending);
  if (opts.signal?.aborted) return;

  const r = result as { is_error?: boolean; subtype?: string; result?: string } | null;
  if (!r) {
    const detail = (stderr || stdout).trim().slice(0, 800);
    throw new ClaudeError(
      `Claude Code exited${code !== null ? ` with code ${code}` : ""} without a result.${detail ? ` ${detail}` : ""}`,
    );
  }
  if (r.is_error || r.subtype !== "success") {
    const msg = r.result?.trim() || r.subtype || "unknown error";
    throw new ClaudeError(`Claude returned an error: ${msg.slice(0, 800)}`);
  }
}

export interface ClaudeStatus {
  installed: boolean;
  loggedIn: boolean;
  authMethod?: string;
  subscriptionType?: string;
  email?: string;
  error?: string;
}

let statusCache: { at: number; value: ClaudeStatus } | null = null;

export async function getClaudeStatus(force = false): Promise<ClaudeStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 60_000) return statusCache.value;

  let value: ClaudeStatus;
  try {
    const { stdout } = await exec(["auth", "status"], { timeoutMs: 30_000 });
    const s = JSON.parse(stdout.trim());
    value = {
      installed: true,
      loggedIn: Boolean(s.loggedIn),
      authMethod: s.authMethod,
      subscriptionType: s.subscriptionType,
      email: s.email,
    };
  } catch (err) {
    value = {
      installed: !(err instanceof ClaudeError && err.message.includes("not found")),
      loggedIn: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  statusCache = { at: Date.now(), value };
  return value;
}
