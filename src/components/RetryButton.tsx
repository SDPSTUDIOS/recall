"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Spinner } from "./ui";

export function RetryButton({ url, label = "Retry generation" }: { url: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(url, { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? <Spinner /> : <RotateCcw className="size-4" />} {label}
    </Button>
  );
}
