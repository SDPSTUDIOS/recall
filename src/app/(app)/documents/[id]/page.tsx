import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { FileText } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { EditableTitle } from "@/components/EditableTitle";
import { GenerateForm } from "@/components/GenerateForm";
import { QuizList } from "@/components/QuizList";
import { BackLink, Badge, PageLoading, SectionTitle } from "@/components/ui";
import { formatBytes, formatDate, isLowText } from "@/lib/format";
import { attemptStats, getDocument, listQuizzes } from "@/lib/repo";

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

  return (
    <div className="space-y-8">
      <div>
        <BackLink href="/">Library</BackLink>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <FileText className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <EditableTitle
                value={doc.name}
                url={`/api/documents/${doc.id}`}
                field="name"
                className="text-xl font-semibold tracking-tight"
              />
              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
                <span>{doc.pageCount} pages</span>·<span>{formatBytes(doc.size)}</span>·
                <span>uploaded {formatDate(doc.createdAt)}</span>
                {lowText && <Badge tone="amber">Scanned, use Visual mode</Badge>}
              </p>
            </div>
          </div>
          <DeleteButton
            url={`/api/documents/${doc.id}`}
            redirectTo="/"
            title={`Delete "${doc.name}"?`}
            body="The PDF and the question sets made only from it are deleted. Combined sets that also use other materials are kept."
          />
        </div>
      </div>

      {quizzes.length > 0 && (
        <section className="space-y-3">
          <SectionTitle>Question sets</SectionTitle>
          <QuizList quizzes={quizzes} stats={stats} />
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle>{quizzes.length > 0 ? "New question set" : "Create your first question set"}</SectionTitle>
        <GenerateForm documents={[{ ...doc, lowText }]} />
      </section>
    </div>
  );
}
