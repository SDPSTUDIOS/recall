"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, type ButtonVariant } from "./ui";

/** A modal built on <dialog>: focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-200 bg-white p-0 text-[var(--foreground)] shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
    >
      {open && (
        <div className="animate-fade-up p-5">
          <h2 className="text-base font-semibold">{title}</h2>
          {children && <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>}
          {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
}

/**
 * Promise-based confirmation: `if (await confirm({...})) ...`.
 * Render the returned element somewhere in the component.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const settle = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const element = (
    <Dialog
      open={!!state}
      onClose={() => settle(false)}
      title={state?.title ?? ""}
      footer={
        <>
          <Button variant="secondary" onClick={() => settle(false)}>
            {state?.cancelLabel ?? "Cancel"}
          </Button>
          <Button variant={state?.variant ?? "primary"} onClick={() => settle(true)} autoFocus>
            {state?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {state?.body}
    </Dialog>
  );

  return [confirm, element];
}
