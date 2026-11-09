import { GitHubAuthError, pollDeviceFlow } from "@/lib/github-auth";

/**
 * Checks whether the student has approved the sign-in on github.com. Once they
 * have, the token goes back to the page that asked, which holds it in memory for
 * one download. Recall doesn't store it.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const deviceCode = typeof body?.deviceCode === "string" ? body.deviceCode : "";
  if (!/^[\w-]{10,200}$/.test(deviceCode)) {
    return Response.json({ error: "Missing sign-in code." }, { status: 400 });
  }
  try {
    return Response.json(await pollDeviceFlow(deviceCode), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      { error: err instanceof GitHubAuthError ? err.message : "Couldn't check GitHub sign-in." },
      { status: 502 },
    );
  }
}
