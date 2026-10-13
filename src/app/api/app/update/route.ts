import { connection } from "next/server";
import { generatingCount, getUpdateStatus, startUpdate } from "@/lib/updates";

export async function GET(request: Request) {
  await connection();
  const force = new URL(request.url).searchParams.has("refresh");
  return Response.json(await getUpdateStatus(force));
}

/** Installs the latest version: the launcher stops this server, updates and restarts it. */
export async function POST(request: Request) {
  // Only this app's own pages may restart it, not another site the student has open.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = await getUpdateStatus(true);
  if (!status.available) return Response.json({ error: "Already up to date." }, { status: 409 });
  if (!status.canInstall) {
    return Response.json({ error: "This copy wasn't installed with the installer." }, { status: 409 });
  }
  const busy = generatingCount();
  if (busy) {
    return Response.json(
      { error: `Wait for ${busy === 1 ? "the question set" : `${busy} question sets`} being generated to finish first.` },
      { status: 409 },
    );
  }

  startUpdate();
  return Response.json({ updating: status.latest }, { status: 202 });
}
