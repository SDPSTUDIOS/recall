import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { FileText } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { EditableTitle } from "@/components/EditableTitle";
import { GenerateForm } from "@/components/GenerateForm";
import { QuizList } from "@/components/QuizList";
import { MoveToUnit } from "@/components/units/MoveToUnit";
import { Badge, IconTile, PageHeader, PageLoading, SectionTitle } from "@/components/ui";
import { formatBytes, formatDate, isLowText } from "@/lib/format";
import { attemptStats, getDocument, getUnit, listQuizzes } from "@/lib/repo";

export default function DocumentPage({ params }: PageProps<"/documents/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <DocumentView params={params} />
    </Suspense>
  );
}

async function DocumentView({ params }: { params: PageProps<"/documents/[id]">["params"] }) {
  const { id } = await params;
  await io();
  const doc = getDocument(id);
  if (!doc) notFound();
  const quizzes = listQuizzes(id);
  const stats = attemptStats();
  const lowText = isLowText(doc);
  const unit = getUnit(doc.unitId);

  return (
    <div className="space-y-12">
      <PageHeader
        back={unit ? { href: `/units/${unit.id}`, label: unit.name } : { href: "/", label: "Library" }}
        eyebrow={unit?.code ? `${unit.code} · Lecture material` : "Lecture material"}
        icon={
          <IconTile size="lg" className="mt-1 hidden sm:grid">
            <FileText className="size-6" />
          </IconTile>
        }
        title={
          <EditableTitle
            value={doc.name}
            url={`/api/documents/${doc.id}`}
            field="name"
            className="font-display text-3xl leading-[1.1] sm:text-4xl"
          />
        }
        meta={
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted">
              <Badge>{doc.pageCount} pages</Badge>
              <Badge>{formatBytes(doc.size)}</Badge>
              <span className="font-mono text-xs text-subtle">uploaded {formatDate(doc.createdAt)}</span>
              {lowText && <Badge tone="amber">Scanned, use Visual mode</Badge>}
            </p>
            <MoveToUnit documentId={doc.id} unitId={doc.unitId} />
          </div>
        }
        actions={
          <DeleteButton
            url={`/api/documents/${doc.id}`}
            redirectTo={unit ? `/units/${unit.id}` : "/"}
            title={`Delete "${doc.name}"?`}
            body="The PDF and the question sets made only from it are deleted. Combined sets that also use other materials are kept."
          />
        }
      />

      {quizzes.length > 0 && (
        <section className="space-y-4">
          <SectionTitle count={quizzes.length}>Question sets</SectionTitle>
          <QuizList quizzes={quizzes} stats={stats} />
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle>{quizzes.length > 0 ? "New question set" : "Create your first question set"}</SectionTitle>
        <GenerateForm documents={[{ ...doc, lowText }]} />
      </section>
    </div>
  );
}
