"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, ErrorText, Spinner } from "../ui";
import { GitHubSignIn } from "./GitHubSignIn";

/**
 * Prepares a failed viva again. No sign-in is kept between attempts, so a private
 * repository asks for one again here.
 */
export function VivaRetry({ vivaId, repoName }: { vivaId: string; repoName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function retry(githubToken?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/vivas/${vivaId}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(githubToken ? { githubToken } : {}),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (json?.needsAuth) setSignIn(true);
        else setError(json?.error ?? "Couldn't retry. Try again.");
        return;
      }
      setSignIn(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (signIn) {
    return (
      <GitHubSignIn
        repoName={repoName}
        busy={busy}
        error={error}
        onToken={(t) => retry(t)}
        onCancel={() => {
          setSignIn(false);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && <ErrorText>{error}</ErrorText>}
      <Button disabled={busy} onClick={() => retry()}>
        {busy ? <Spinner /> : <RotateCcw className="size-4" />} Retry preparation
      </Button>
    </div>
  );
}
