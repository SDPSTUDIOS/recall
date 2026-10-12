import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState, buttonClass } from "./ui";

export function NotFoundCard() {
  return (
    <EmptyState
      icon={<SearchX className="size-5" />}
      title="Not found"
      action={
        <Link href="/" className={buttonClass("primary")}>
          Back to library
        </Link>
      }
    >
      This page doesn&apos;t exist, or the material or set was deleted.
    </EmptyState>
  );
}
