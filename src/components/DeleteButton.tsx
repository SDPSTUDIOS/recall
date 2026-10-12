"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { useConfirm } from "./Dialog";
import { Button, Spinner } from "./ui";

export function DeleteButton({
  url,
  title,
  body,
  redirectTo,
  label = "Delete",
}: {
  url: string;
  title: string;
  body?: ReactNode;
  redirectTo?: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, dialog] = useConfirm();

  return (
    <>
      <Button
        variant="danger"
        disabled={busy}
        onClick={async () => {
          if (!(await confirm({ title, body, confirmLabel: label, variant: "danger-solid" }))) return;
          setBusy(true);
          await fetch(url, { method: "DELETE" });
          if (redirectTo) router.push(redirectTo);
          router.refresh();
          // Routes stay mounted after navigation, so reset for when the user comes back.
          setBusy(false);
        }}
      >
        {busy ? <Spinner /> : <Trash2 className="size-4" />}
        {label}
      </Button>
      {dialog}
    </>
  );
}
