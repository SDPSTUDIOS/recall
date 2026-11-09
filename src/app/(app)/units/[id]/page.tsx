import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { FileText, Layers } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { EditableTitle } from "@/components/EditableTitle";
import { MaterialGrid } from "@/components/MaterialGrid";
import { QuizList } from "@/components/QuizList";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UnitCodeField } from "@/components/units/UnitCodeField";
import { EmptyState, PageHeader, PageLoading, SectionTitle, buttonClass } from "@/components/ui";
import { attemptStats, getUnit, listDocuments, listUnitQuizzes } from "@/lib/repo";

export default function UnitPage({ params }: PageProps<"/units/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <UnitView params={params} />
    </Suspense>
  );
}

async function UnitView({ params }: { params: PageProps<"/units/[id]">["params"] }) {
  const { id } = await params;
  await io();
  const unit = getUnit(id);
  if (!unit) notFound();
  const documents = listDocuments(id);
  const quizzes = listUnitQuizzes(id);
  const stats = attemptStats();
  const pages = documents.reduce((n, d) => n + d.pageCount, 0);

  return (
    <div className="space-y-12">
      <PageHeader
        back={{ href: "/", label: "Library" }}
        eyebrow="Unit"
        title={
          <EditableTitle
            value={unit.name}
            url={`/api/units/${unit.id}`}
            field="name"
            className="font-display text-3xl leading-[1.1] sm:text-4xl"
          />
        }
        meta={
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-subtle">
            <UnitCodeField unitId={unit.id} code={unit.code} />
            <span aria-hidden className="h-3 w-px bg-line-strong" />
            <span>
              {documents.length} {documents.length === 1 ? "material" : "materials"} · {pages} pages ·{" "}
              {quizzes.length} {quizzes.length === 1 ? "set" : "sets"}
            </span>
          </div>
        }
        actions={
          <>
            {documents.length > 0 && (
              <Link href={`/generate?unit=${unit.id}`} className={buttonClass("primary")}>
                <Layers className="size-4" /> New set from unit
              </Link>
            )}
            <DeleteButton
              url={`/api/units/${unit.id}`}
              redirectTo="/"
              label="Delete unit"
              title={`Delete "${unit.name}"?`}
              body={
                documents.length === 0
                  ? "This unit is empty."
                  : `Its ${documents.length} ${documents.length === 1 ? "PDF" : "PDFs"} and the question sets made only from them are deleted. This can't be undone. To keep a PDF, move it to another unit from its page first.`
              }
            />
          </>
        }
      />

      <UploadDropzone unitId={unit.id} />

      <section className="space-y-4">
        <SectionTitle count={documents.length}>Lecture materials</SectionTitle>
        {documents.length > 0 ? (
          <MaterialGrid documents={documents} />
        ) : (
          <EmptyState icon={<FileText className="size-5" />} title="No materials in this unit yet">
            Drop this unit&apos;s lecture PDFs above.
          </EmptyState>
        )}
      </section>

      {quizzes.length > 0 && (
        <section className="space-y-4">
          <SectionTitle count={quizzes.length}>Question sets</SectionTitle>
          <QuizList quizzes={quizzes} stats={stats} showDocument />
        </section>
      )}
    </div>
  );
}
