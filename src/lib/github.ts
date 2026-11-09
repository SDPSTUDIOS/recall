import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";

export interface RepoRef {
  owner: string;
  repo: string;
  /** Branch, tag or commit from a /tree/<ref> link; null for the default branch. */
  branch: string | null;
  /** "owner/repo" */
  name: string;
  cloneUrl: string;
  webUrl: string;
}

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const REF = /^[A-Za-z0-9_./-]{1,200}$/;

/**
 * Accepts the forms people paste: https://github.com/owner/repo (with .git, a trailing
 * slash, or /tree/<branch>), github.com/owner/repo, git@github.com:owner/repo.git and owner/repo.
 */
export function parseGitHubUrl(input: string): RepoRef | null {
  let s = input.trim().replace(/[?#].*$/, "");
  s = s.replace(/^git@github\.com:/i, "github.com/");
  s = s.replace(/^(https?:\/\/)?(www\.)?github\.com\//i, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/i, "");
  if (!NAME.test(owner) || !NAME.test(repo) || repo === "." || repo === "..") return null;

  let branch: string | null = null;
  if (parts[2] === "tree" && parts.length > 3) {
    branch = parts.slice(3).join("/");
    if (!REF.test(branch) || branch.startsWith("-") || branch.includes("..")) return null;
  } else if (parts.length > 2 && !["blob", "tree", "pulls", "issues", "commits"].includes(parts[2])) {
    return null;
  }

  return {
    owner,
    repo,
    branch,
    name: `${owner}/${repo}`,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
    webUrl: `https://github.com/${owner}/${repo}`,
  };
}

export class GitError extends Error {
  /** The repository wasn't found without signing in: it may be private. */
  readonly needsAuth: boolean;
  constructor(message: string, opts?: { needsAuth?: boolean }) {
    super(message);
    this.needsAuth = opts?.needsAuth ?? false;
  }
}

/** GitHub access tokens: classic (ghp_, gho_…), fine-grained (github_pat_…) and OAuth tokens. */
export const isGitHubToken = (t: unknown): t is string => typeof t === "string" && /^[\w-]{20,255}$/.test(t);

/**
 * git must never stop to ask for a password: the server has no terminal to answer it.
 *
 * A token is used for this one command and kept nowhere: it goes in an HTTP header
 * set through environment variables (so it is not in the command line, the clone's
 * config or the remote URL), and credential helpers are switched off so Git
 * Credential Manager can't save it.
 */
function gitEnv(token?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
    GIT_ASKPASS: "",
    SSH_ASKPASS: "",
    GIT_LFS_SKIP_SMUDGE: "1",
  };
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    Object.assign(env, {
      GIT_CONFIG_COUNT: "2",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "",
      GIT_CONFIG_KEY_1: "http.https://github.com/.extraheader",
      GIT_CONFIG_VALUE_1: `Authorization: Basic ${basic}`,
    });
  }
  return env;
}

function git(args: string[], opts: { cwd?: string; timeoutMs: number; token?: string }): Promise<string> {
  // Belt and braces: git shouldn't print the header, but never pass the token on if it does.
  const scrub = (s: string) => (opts.token ? s.replaceAll(opts.token, "***") : s);
  return new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd: opts.cwd, env: gitEnv(opts.token), timeout: opts.timeoutMs, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (!err) return resolve(stdout);
        const e = err as NodeJS.ErrnoException & { killed?: boolean };
        if (e.code === "ENOENT") {
          reject(new GitError("Git isn't installed or isn't on PATH. Install Git (git-scm.com) and restart Recall."));
        } else if (e.killed) {
          reject(new GitError(`Git took longer than ${Math.round(opts.timeoutMs / 1000)} seconds and was stopped.`));
        } else {
          reject(new GitError(scrub((stderr || e.message).trim()).slice(0, 600)));
        }
      },
    );
  });
}

/** GitHub answers "not found" for both a typo and a private repository it won't show you. */
function unreachable(ref: RepoRef, token?: string, gitMessage = ""): GitError {
  // With a token attached, GitHub only asks for credentials (401) when it rejects the token;
  // a valid token without access gets "Repository not found" instead.
  if (token && /Authentication failed|Invalid username or (token|password)|could not read Username/i.test(gitMessage)) {
    return new GitError(
      "GitHub didn't accept that sign-in. The token may be mistyped, expired or revoked. Sign in again.",
    );
  }
  return token
    ? new GitError(
        `Your GitHub account can't see ${ref.webUrl}. Check the link, and that the account you signed in with has access. Repositories owned by an organisation may also need the organisation to allow access.`,
      )
    : new GitError(
        `Couldn't find ${ref.webUrl}. If the link is right, the repository is probably private: sign in to GitHub to fetch it.`,
        { needsAuth: true },
      );
}

/** Fails fast on a typo or a private repository, before anything is queued. */
export async function checkRepoReachable(ref: RepoRef, token?: string): Promise<void> {
  let out: string;
  try {
    out = await git(["ls-remote", "--heads", "--tags", ref.cloneUrl], { timeoutMs: 30_000, token });
  } catch (err) {
    if (err instanceof GitError && /isn't installed|longer than/.test(err.message)) throw err;
    throw unreachable(ref, token, err instanceof Error ? err.message : "");
  }
  if (!out.trim()) throw new GitError(`${ref.name} is empty: it has no commits to examine.`);
  if (ref.branch) {
    const refs = out.split("\n").map((l) => l.split("\t")[1]?.trim());
    const found = refs.some((r) => r === `refs/heads/${ref.branch}` || r === `refs/tags/${ref.branch}`);
    if (!found) throw new GitError(`${ref.name} has no branch or tag called "${ref.branch}".`);
  }
}

/**
 * Shallow-clones the repository into `dir`. Symlinks are checked out as plain
 * files so nothing in the clone can point Claude at files outside it.
 */
export async function cloneRepo(
  ref: RepoRef,
  dir: string,
  token?: string,
): Promise<{ branch: string | null; commit: string | null }> {
  await fs.rm(dir, { recursive: true, force: true });
  const args = [
    "-c", "core.symlinks=false",
    "-c", "core.longpaths=true",
    "clone", "--depth", "1", "--single-branch", "--no-tags",
  ];
  if (ref.branch) args.push("--branch", ref.branch);
  args.push("--", ref.cloneUrl, dir);
  try {
    await git(args, { timeoutMs: 3 * 60 * 1000, token });
  } catch (err) {
    if (err instanceof GitError && /longer than|isn't installed/.test(err.message)) throw err;
    const e = unreachable(ref, token, err instanceof Error ? err.message : "");
    throw new GitError(`${e.message}${err instanceof Error && err.message ? `\n\n${err.message}` : ""}`, {
      needsAuth: e.needsAuth,
    });
  }
  const read = (args: string[]) =>
    git(args, { cwd: dir, timeoutMs: 15_000 })
      .then((s) => s.trim() || null)
      .catch(() => null);
  const [commit, head] = await Promise.all([read(["rev-parse", "HEAD"]), read(["rev-parse", "--abbrev-ref", "HEAD"])]);
  return { commit, branch: ref.branch ?? (head && head !== "HEAD" ? head : null) };
}

/** Folders and files that say little about the student's own work. */
const NOISE = [
  /(^|\/)(\.git|__MACOSX)\//,
  /(^|\/)\.DS_Store$/,
  /(^|\/)(node_modules|vendor|dist|build|out|target|\.next|\.venv|venv|__pycache__|coverage|\.gradle|\.idea|\.vscode|bin|obj)\//,
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|Cargo\.lock|composer\.lock|Gemfile\.lock|go\.sum)$/,
  /\.(png|jpe?g|gif|webp|ico|svg|bmp|mp[34]|wav|mov|avi|woff2?|ttf|otf|eot|pdf|zip|gz|tar|jar|exe|dll|so|dylib|class|o|pyc|min\.js|map)$/i,
];

/** Dependencies, build output, lockfiles, binaries and OS clutter. */
export const isNoise = (path: string) => NOISE.some((re) => re.test(path));

/** Tracked files in the clone, minus dependencies, build output, lockfiles and binaries. */
export async function listRepoFiles(dir: string): Promise<{ files: string[]; total: number }> {
  const out = await git(["-c", "core.quotepath=false", "ls-files"], { cwd: dir, timeoutMs: 30_000 });
  const all = out.split("\n").map((l) => l.trim()).filter(Boolean);
  return { files: all.filter((f) => !isNoise(f)), total: all.length };
}
