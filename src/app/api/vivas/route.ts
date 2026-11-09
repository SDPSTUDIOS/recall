import { randomUUID } from "node:crypto";
import { GitError, checkRepoReachable, isGitHubToken, parseGitHubUrl } from "@/lib/github";
import { insertViva } from "@/lib/repo";
import type { VivaConfig, VivaSource } from "@/lib/types";
import { saveVivaZip, startVivaPrep } from "@/lib/viva";
import { MAX_ZIP_BYTES, ZipError, planZip } from "@/lib/zip";

const EFFORTS = ["default", "low", "medium", "high", "xhigh", "max"];
const DIFFICULTIES = ["easy", "medium", "hard", "mixed"];

type Fields = Record<string, unknown>;

function readConfig(f: Fields): VivaConfig | string {
  const model = String(f.model ?? "").trim();
  if (!/^[\w.\-\[\]]{2,80}$/.test(model)) return "Enter a valid model alias or ID.";
  return {
    model,
    effort: EFFORTS.includes(String(f.effort)) ? (f.effort as VivaConfig["effort"]) : "default",
    topicCount: Math.min(12, Math.max(2, Math.floor(Number(f.topicCount) || 6))),
    difficulty: DIFFICULTIES.includes(String(f.difficulty)) ? (f.difficulty as VivaConfig["difficulty"]) : "mixed",
    focus: String(f.focus ?? "").slice(0, 1000),
  };
}

function create(v: {
  source: VivaSource;
  repoUrl: string;
  repoName: string;
  branch: string | null;
  title: unknown;
  config: VivaConfig;
}) {
  const id = randomUUID();
  insertViva({
    id,
    ...v,
    title: String(v.title ?? "").trim().slice(0, 120) || v.repoName,
    createdAt: Date.now(),
  });
  return id;
}

/**
 * Starts a viva on a GitHub repository (JSON with "repoUrl") or an uploaded zip
 * (multipart form with "file"), checks the code can be read, then prepares the
 * viva in the background. A private repository answers {needsAuth: true}; send it
 * again with "githubToken", which is used for that download only and never saved.
 */
export async function POST(request: Request) {
  if (request.headers.get("content-type")?.includes("multipart/form-data")) return fromZip(request);

  const body = (await request.json().catch(() => null)) as Fields | null;
  const ref = parseGitHubUrl(String(body?.repoUrl ?? ""));
  if (!body || !ref) {
    return Response.json(
      { error: "Enter a GitHub repository link, like https://github.com/owner/repo." },
      { status: 400 },
    );
  }
  const config = readConfig(body);
  if (typeof config === "string") return Response.json({ error: config }, { status: 400 });

  const token = isGitHubToken(body.githubToken) ? body.githubToken : undefined;
  try {
    await checkRepoReachable(ref, token);
  } catch (err) {
    return Response.json(
      {
        error: err instanceof GitError ? err.message : "Couldn't check the repository.",
        needsAuth: err instanceof GitError && err.needsAuth,
        repoName: ref.name,
      },
      { status: 400 },
    );
  }

  const id = create({
    source: "github",
    repoUrl: ref.webUrl + (ref.branch ? `/tree/${ref.branch}` : ""),
    repoName: ref.name,
    branch: ref.branch,
    title: body.title,
    config,
  });
  startVivaPrep(id, token);
  return Response.json({ id });
}

async function fromZip(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return Response.json({ error: "Choose a zip file." }, { status: 400 });
  if (!/\.zip$/i.test(file.name)) return Response.json({ error: "Choose a .zip file." }, { status: 400 });
  if (file.size > MAX_ZIP_BYTES) {
    return Response.json(
      {
        error: `That zip is ${Math.round(file.size / 1024 / 1024)} MB; the limit is ${MAX_ZIP_BYTES / 1024 / 1024} MB. Leave out dependencies (node_modules, venv) and build output.`,
      },
      { status: 400 },
    );
  }

  const config = readConfig(Object.fromEntries(form.entries()));
  if (typeof config === "string") return Response.json({ error: config }, { status: 400 });

  const data = new Uint8Array(await file.arrayBuffer());
  try {
    planZip(data); // fails now, not in the background, if there's nothing to examine
  } catch (err) {
    return Response.json({ error: err instanceof ZipError ? err.message : "Couldn't read the zip." }, { status: 400 });
  }

  const name = file.name.replace(/\.zip$/i, "").trim().slice(0, 100) || "Uploaded project";
  const id = create({ source: "zip", repoUrl: "", repoName: name, branch: null, title: form.get("title"), config });
  await saveVivaZip(id, data);
  startVivaPrep(id);
  return Response.json({ id });
}
