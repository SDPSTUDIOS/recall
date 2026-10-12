import type { ClaudeStatus } from "./claude";

export type CheckState = "pass" | "warn" | "fail" | "pending";

export interface EligibilityCheck {
  id: "installed" | "signedIn" | "plan";
  label: string;
  state: CheckState;
  detail: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * What Recall needs: Claude Code on this computer, signed in, and signed in with
 * a Claude subscription (Pro, Max, Team or Enterprise) rather than an API account.
 * A non-subscription login still works, so the plan check warns instead of failing.
 */
export function checkEligibility(status: ClaudeStatus | null): {
  checks: EligibilityCheck[];
  ready: boolean;
} {
  if (!status) {
    return {
      ready: false,
      checks: [
        { id: "installed", label: "Claude Code installed", state: "pending", detail: "Checking…" },
        { id: "signedIn", label: "Signed in to Claude", state: "pending", detail: "Checking…" },
        { id: "plan", label: "Claude subscription", state: "pending", detail: "Checking…" },
      ],
    };
  }

  const subscription =
    status.loggedIn && status.authMethod === "claude.ai" && status.subscriptionType
      ? capitalize(status.subscriptionType)
      : null;

  const checks: EligibilityCheck[] = [
    {
      id: "installed",
      label: "Claude Code installed",
      state: status.installed ? "pass" : "fail",
      detail: status.installed
        ? "Found the claude command on this computer."
        : "Recall talks to Claude through the Claude Code command-line tool.",
    },
    {
      id: "signedIn",
      label: "Signed in to Claude",
      state: !status.installed ? "pending" : status.loggedIn ? "pass" : "fail",
      detail: !status.installed
        ? "Install Claude Code first."
        : status.loggedIn
          ? `Signed in${status.email ? ` as ${status.email}` : ""}.`
          : "Sign in once from a terminal. Recall itself has no account.",
    },
    {
      id: "plan",
      label: "Claude subscription",
      state: !status.loggedIn ? "pending" : subscription ? "pass" : "warn",
      detail: !status.loggedIn
        ? "Checked once you're signed in."
        : subscription
          ? `${subscription} plan. Generating and grading count toward its usage limits.`
          : "This login isn't a Claude subscription, so requests may be billed to an API account.",
    },
  ];

  return { checks, ready: status.installed && status.loggedIn };
}
