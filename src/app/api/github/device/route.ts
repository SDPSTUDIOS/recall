import { connection } from "next/server";
import { GitHubAuthError, githubClientId, startDeviceFlow } from "@/lib/github-auth";

/** Whether "Sign in with GitHub" is set up (otherwise students paste a token). */
export async function GET() {
  // Read the environment per request, not once at build time.
  await connection();
  return Response.json({ enabled: githubClientId() !== null });
}

/** Starts a GitHub sign-in: returns the code for the student to enter on github.com. */
export async function POST() {
  try {
    return Response.json(await startDeviceFlow());
  } catch (err) {
    return Response.json(
      { error: err instanceof GitHubAuthError ? err.message : "Couldn't start GitHub sign-in." },
      { status: 502 },
    );
  }
}
