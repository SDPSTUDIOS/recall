import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { AlertTriangle, ArrowRight, FileArchive, GitBranch } from "lucide-react";
import { NewVivaForm } from "@/components/viva/NewVivaForm";
import { Badge, Card, IconTile, PageHeader, PageLoading, SectionTitle, scoreTone } from "@/components/ui";
import { formatRelative } from "@/lib/format";
import { listVivas } from "@/lib/repo";
import type { VivaRecord } from "@/lib/types";

export const metadata: Metadata = { title: "Viva" };

export default function VivasPage() {
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Viva practice"
        title={
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
            Defend your code, <span className="text-subtle">out loud.</span>
          </h1>
        }
        description={
          <>
            Give Recall a GitHub repository or a zip of your project and Claude reads the code, then examines you on it
            in a text viva: how it works, why you built it that way and what you&apos;d change. You get a score and
            feedback for each topic.
          </>
        }
      />
      <NewVivaForm />
      <Suspense fallback={<PageLoading />}>
        <PastVivas />
      </Suspense>
    </div>
  );
}

async function PastVivas() {
  await io();
  const vivas = listVivas();
  if (vivas.length === 0) return null;
  return (
    <section className="space-y-4">
      <SectionTitle count={vivas.length}>Your vivas</SectionTitle>
      <div className="stagger space-y-2">
        {vivas.map((v, i) => (
          <Link
            key={v.id}
            href={`/vivas/${v.id}`}
            className="group block rounded-xl"
            style={{ "--i": i } as React.CSSProperties}
          >
            <Card interactive className="flex items-center gap-4 px-4 py-3.5">
              <IconTile tone="zinc" size="sm">
                {v.source === "zip" ? <FileArchive className="size-4" /> : <GitBranch className="size-4" />}
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {v.title}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted">
                  <span className="font-mono">{v.source === "zip" ? `${v.repoName}.zip` : v.repoName}</span>
                  {v.branch ? ` · ${v.branch}` : ""} · {v.config.topicCount} topics · {formatRelative(v.createdAt)}
                </div>
              </div>
              <VivaBadge viva={v} />
              <ArrowRight className="size-4 shrink-0 text-subtle transition-transform duration-300 group-hover:translate-x-0.5" />
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}

function VivaBadge({ viva }: { viva: VivaRecord }) {
  if (viva.status === "preparing") {
    return (
      <Badge>
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inset-0 animate-ping rounded-full bg-foreground" />
          <span className="relative size-1.5 rounded-full bg-foreground" />
        </span>
        Preparing
      </Badge>
    );
  }
  if (viva.status === "error") {
    return (
      <Badge tone="red">
        <AlertTriangle className="size-3" /> Failed
      </Badge>
    );
  }
  if (viva.result) return <Badge tone={scoreTone(viva.result.score / 100)}>{viva.result.score}%</Badge>;
  if (viva.messages.length > 0) return <Badge tone="amber">In progress</Badge>;
  return <Badge tone="brand">Ready</Badge>;
}
