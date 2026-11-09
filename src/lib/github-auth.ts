import "server-only";

/**
 * "Sign in with GitHub" for fetching a private repository, using GitHub's device
 * flow: Recall shows a short code, the student enters it at github.com/login/device,
 * and Recall receives a token. The token is used for one download and kept nowhere.
 *
 * Needs a GitHub OAuth App with "Enable Device Flow" ticked, its client ID in
 * GITHUB_CLIENT_ID (.env.local). The device flow needs no client secret.
 */

/** OAuth Apps have no read-only scope for private repositories; "repo" is the narrowest that works. */
const SCOPE = "repo";

export const githubClientId = () => process.env.GITHUB_CLIENT_ID?.trim() || null;

export class GitHubAuthError extends Error {}

async function post<T>(url: string, params: Record<string, string>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new GitHubAuthError("Couldn't reach GitHub. Check your internet connection.");
  }
  const json = (await res.json().catch(() => null)) as T | null;
  if (!json) throw new GitHubAuthError(`GitHub answered with an error (${res.status}).`);
  return json;
}

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
}

export async function startDeviceFlow(): Promise<DeviceCode> {
  const clientId = githubClientId();
  if (!clientId) throw new GitHubAuthError("GitHub sign-in isn't set up. Set GITHUB_CLIENT_ID in .env.local.");
  const r = await post<{
    device_code?: string;
    user_code?: string;
    verification_uri?: string;
    expires_in?: number;
    interval?: number;
    error?: string;
    error_description?: string;
  }>("https://github.com/login/device/code", { client_id: clientId, scope: SCOPE });

  if (!r.device_code || !r.user_code) {
    throw new GitHubAuthError(
      r.error === "device_flow_disabled"
        ? "Device flow is turned off for this GitHub OAuth App. Tick \"Enable Device Flow\" in its settings on GitHub."
        : r.error === "incorrect_client_credentials" || r.error === "Not Found"
          ? "GitHub doesn't recognise GITHUB_CLIENT_ID. Check it matches your OAuth App's client ID."
          : `GitHub couldn't start sign-in${r.error_description ? `: ${r.error_description}` : "."}`,
    );
  }
  return {
    deviceCode: r.device_code,
    userCode: r.user_code,
    verificationUri: r.verification_uri ?? "https://github.com/login/device",
    expiresIn: r.expires_in ?? 900,
    interval: r.interval ?? 5,
  };
}

export type DevicePoll =
  | { status: "pending"; interval?: number }
  | { status: "done"; token: string }
  | { status: "expired" | "denied" };

/** Asks GitHub once whether the student has entered the code yet. */
export async function pollDeviceFlow(deviceCode: string): Promise<DevicePoll> {
  const clientId = githubClientId();
  if (!clientId) throw new GitHubAuthError("GitHub sign-in isn't set up.");
  const r = await post<{ access_token?: string; error?: string; interval?: number; error_description?: string }>(
    "https://github.com/login/oauth/access_token",
    { client_id: clientId, device_code: deviceCode, grant_type: "urn:ietf:params:oauth:grant-type:device_code" },
  );

  if (r.access_token) return { status: "done", token: r.access_token };
  switch (r.error) {
    case "authorization_pending":
      return { status: "pending" };
    case "slow_down":
      return { status: "pending", interval: r.interval };
    case "expired_token":
      return { status: "expired" };
    case "access_denied":
      return { status: "denied" };
    default:
      throw new GitHubAuthError(`GitHub sign-in failed${r.error_description ? `: ${r.error_description}` : "."}`);
  }
}
