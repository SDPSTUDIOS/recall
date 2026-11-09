import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { io } from "next/cache";
import { AlertTriangle, ChevronRight, ExternalLink, FileArchive, FileCode2 } from "lucide-react";
import { DeleteButton } from "@/components/DeleteButton";
import { EditableTitle } from "@/components/EditableTitle";
import { Badge, Card, PageHeader, PageLoading } from "@/components/ui";
import { VivaPreparing } from "@/components/viva/VivaPreparing";
import { VivaResults } from "@/components/viva/VivaResults";
import { VivaRetry } from "@/components/viva/VivaRetry";
import { VivaRoom } from "@/components/viva/VivaRoom";
import { formatDuration } from "@/lib/format";
import { getViva } from "@/lib/repo";
import type { VivaBrief } from "@/lib/types";

export default function VivaPage({ params }: PageProps<"/vivas/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <VivaView params={params} />
    </Suspense>
  );
}

async function VivaView({ params }: { params: PageProps<"/vivas/[id]">["params"] }) {
  const { id } = await params;
  await io();
  const viva = getViva(id);
  if (!viva) notFound();
  const brief = viva.status === "ready" ? viva.brief : null;

  return (
    <div className="space-y-8">
      <PageHeader
        back={{ href: "/vivas", label: "Vivas" }}
        eyebrow="Viva"
        title={
          <EditableTitle
            value={viva.title}
            url={`/api/vivas/${viva.id}`}
            field="title"
            className="font-display text-3xl leading-[1.1] sm:text-4xl"
          />
        }
        meta={
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted">
              {viva.source === "zip" ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[13px] font-medium text-muted">
                  <FileArchive className="size-3.5" aria-hidden />
                  {viva.repoName}.zip
                </span>
              ) : (
                <a
                  href={viva.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[13px] font-medium text-muted underline-offset-4 hover:text-foreground hover:underline"
                >
                  {viva.repoName}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
              )}
              {viva.branch && <Badge>{viva.branch}</Badge>}
              {viva.commit && <code className="font-mono text-xs text-subtle">{viva.commit.slice(0, 7)}</code>}
              <Badge className="font-mono">{viva.modelUsed ?? viva.config.model}</Badge>
              {viva.config.difficulty !== "mixed" && <Badge className="capitalize">{viva.config.difficulty}</Badge>}
              {viva.durationMs && (
                <span className="font-mono text-xs text-subtle">prepared in {formatDuration(viva.durationMs)}</span>
              )}
            </p>
        }
        actions={
          <DeleteButton
            url={`/api/vivas/${viva.id}`}
            redirectTo="/vivas"
            title={`Delete "${viva.title}"?`}
            body="The conversation and feedback will be deleted too."
          />
        }
      />

      {viva.status === "preparing" && (
        <VivaPreparing
          vivaId={viva.id}
          startedAt={viva.startedAt}
          model={viva.config.model}
          repoName={viva.repoName}
          source={viva.source}
        />
      )}

      {viva.status === "error" && (
        <Card className="space-y-5 border-red-500/25 p-6">
          <div className="flex gap-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/20 dark:text-red-400">
              <AlertTriangle className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="font-display text-xl">Couldn&apos;t prepare the viva</div>
              <p className="mt-1.5 font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-muted">
                {viva.error}
              </p>
              <p className="mt-2 text-xs text-muted">
                If it keeps failing, try another model, or check{" "}
                <Link href="/setup" className="underline">
                  setup
                </Link>
                .
              </p>
            </div>
          </div>
          <VivaRetry vivaId={viva.id} repoName={viva.repoName} />
        </Card>
      )}

      {brief && <ProjectOverview brief={brief} />}

      {brief &&
        (viva.result ? (
          <VivaResults vivaId={viva.id} brief={brief} result={viva.result} messages={viva.messages} />
        ) : (
          // Only the number of topics reaches the browser: the planned questions stay on the server.
          <VivaRoom
            vivaId={viva.id}
            repoName={viva.repoName}
            topicCount={brief.topics.length}
            initialMessages={viva.messages}
            initialTopic={viva.topicIndex}
            initialEnded={viva.ended}
          />
        ))}
    </div>
  );
}

/** What Claude found in the repository. Safe to show: it gives nothing about the questions away. */
function ProjectOverview({ brief }: { brief: VivaBrief }) {
  return (
    <details className="surface group overflow-hidden rounded-xl">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100 text-subtle">
          <FileCode2 className="size-4" aria-hidden />
        </span>
        <span className="text-sm font-medium">About the project</span>
        <span className="hidden min-w-0 flex-1 truncate text-xs text-muted sm:block">{brief.stack.join(" · ")}</span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-subtle transition-transform duration-300 group-open:rotate-90" />
      </summary>
      <div className="space-y-4 border-t border-line px-5 py-5 text-sm leading-relaxed">
        <p>{brief.summary}</p>
        {brief.stack.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {brief.stack.map((s) => (
              <Badge key={s}>{s}</Badge>
            ))}
          </div>
        )}
        {brief.architecture && <p className="text-muted">{brief.architecture}</p>}
        {brief.keyFiles.length > 0 && (
          <ul className="space-y-1">
            {brief.keyFiles.map((f) => (
              <li key={f.path}>
                <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-xs ring-1 ring-inset ring-line">{f.path}</code>{" "}
                <span className="text-muted">{f.purpose}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
