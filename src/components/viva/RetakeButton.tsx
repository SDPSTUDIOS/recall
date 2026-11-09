"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { useConfirm } from "../Dialog";
import { Button, Spinner } from "../ui";

/** Clears the transcript and feedback so the same viva can be taken again. */
export function RetakeButton({ vivaId }: { vivaId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirm();
  return (
    <>
      <Button
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          const ok = await confirm({
            title: "Retake this viva?",
            body: "The examiner asks about the same topics again. This conversation and its feedback will be deleted.",
            confirmLabel: "Retake viva",
          });
          if (!ok) return;
          setBusy(true);
          await fetch(`/api/vivas/${vivaId}/turn`, { method: "DELETE" });
          router.refresh();
          setBusy(false);
        }}
      >
        {busy ? <Spinner /> : <RotateCcw className="size-4" />} Retake viva
      </Button>
      {dialog}
    </>
  );
}
