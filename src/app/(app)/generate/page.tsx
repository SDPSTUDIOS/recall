import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { Upload } from "lucide-react";
import { GenerateForm } from "@/components/GenerateForm";
import { BackLink, EmptyState, PageLoading, buttonClass } from "@/components/ui";
import { isLowText } from "@/lib/format";
import { listDocuments } from "@/lib/repo";

export const metadata: Metadata = { title: "New question set" };

export default function GeneratePage() {
  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/">Library</BackLink>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New question set</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Pick the lectures to cover. Claude spreads the questions across them and notes where each
          one comes from.
        </p>
      </div>
      <Suspense fallback={<PageLoading />}>
        <Picker />
      </Suspense>
    </div>
  );
}

async function Picker() {
  await io();
  const documents = listDocuments();
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<Upload className="size-5" />}
        title="No lecture materials yet"
        action={
          <Link href="/" className={buttonClass("primary")}>
            Upload PDFs
          </Link>
        }
      >
        Upload some lecture PDFs first, then come back to build a question set from them.
      </EmptyState>
    );
  }
  // Oldest first, so lectures appear in course order.
  const ordered = [...documents].reverse().map((d) => ({
    id: d.id,
    name: d.name,
    pageCount: d.pageCount,
    lowText: isLowText(d),
  }));
  return <GenerateForm documents={ordered} pickable />;
}
