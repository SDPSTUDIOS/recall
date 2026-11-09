import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { Upload } from "lucide-react";
import { GenerateForm } from "@/components/GenerateForm";
import { EmptyState, PageHeader, PageLoading, buttonClass } from "@/components/ui";
import { isLowText } from "@/lib/format";
import { listDocuments, listUnits } from "@/lib/repo";

export const metadata: Metadata = { title: "New question set" };

export default function GeneratePage({ searchParams }: PageProps<"/generate">) {
  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/", label: "Library" }}
        eyebrow="Create"
        title={
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
            A new <span className="text-subtle">question set</span>
          </h1>
        }
        description="Pick a unit's lectures to cover. Claude spreads the questions across them and notes where each one comes from."
      />
      <Suspense fallback={<PageLoading />}>
        <Picker searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Picker({ searchParams }: { searchParams: PageProps<"/generate">["searchParams"] }) {
  const { unit } = await searchParams;
  await io();
  const documents = listDocuments();
  const units = listUnits();
  if (documents.length === 0) {
    return (
      <EmptyState
        icon={<Upload className="size-6" />}
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
  // Grouped by unit (newest unit first), lectures oldest first so they read in course order.
  const unitOrder = new Map(units.map((u, i) => [u.id, i]));
  const unitLabel = new Map(units.map((u) => [u.id, u.code ? `${u.code} · ${u.name}` : u.name]));
  const ordered = [...documents]
    .reverse()
    .sort((a, b) => (unitOrder.get(a.unitId) ?? 0) - (unitOrder.get(b.unitId) ?? 0))
    .map((d) => ({
      id: d.id,
      name: d.name,
      pageCount: d.pageCount,
      lowText: isLowText(d),
      unitId: d.unitId,
      unitName: unitLabel.get(d.unitId) ?? "Unit",
    }));
  const requested = typeof unit === "string" && unitOrder.has(unit) ? unit : undefined;
  return <GenerateForm documents={ordered} pickable initialUnitId={requested ?? ordered[0]?.unitId} />;
}
