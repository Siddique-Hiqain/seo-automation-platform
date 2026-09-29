import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Lightbulb, PenLine, Search } from "lucide-react";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../ui";
import { useArticles, useIsWriting, useWriteArticle } from "../../lib/queries";
import type { ArticleItem } from "../../lib/types";
import { cn, formatDate, timeAgo } from "../../lib/utils";

type View = "written" | "unwritten";

export const articleStatusTone = (s: string | null) =>
  s === "published" ? ("success" as const) : s === "draft" ? ("warning" as const) : ("neutral" as const);

export function ArticlesTab({ websiteId, onNavigate }: { websiteId: number; onNavigate: (t: "topics") => void }) {
  const { data, isLoading, error, refetch } = useArticles(websiteId);
  const [view, setView] = useState<View>("written");
  const [query, setQuery] = useState("");

  if (isLoading)
    return (
      <Card className="divide-y divide-line">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 p-5">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </Card>
    );
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const written = data?.written ?? [];
  const unwritten = data?.unwritten ?? [];

  if (written.length === 0 && unwritten.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="No articles yet"
          description="Research topics first. Each topic can be turned into a full SEO article with one click."
          action={
            <Button variant="secondary" icon={Lightbulb} onClick={() => onNavigate("topics")}>
              Go to topics
            </Button>
          }
        />
      </Card>
    );
  }

  const q = query.trim().toLowerCase();
  const list = (view === "written" ? written : unwritten).filter((a) => !q || a.title.toLowerCase().includes(q));
  const sorted = view === "written" ? [...list].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")) : list;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-line bg-surface-2/60 p-1">
          {(
            [
              ["written", "Written", written.length],
              ["unwritten", "Not yet written", unwritten.length],
            ] as const
          ).map(([v, label, n]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition sm:flex-none",
                view === v ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
              )}
            >
              {label}
              <span className="text-xs tabular-nums opacity-70">{n}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="input pl-10"
            placeholder="Search by title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search articles"
          />
        </div>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={view === "written" ? FileText : Lightbulb}
            title={q ? "Nothing matches your search" : view === "written" ? "No articles written yet" : "Every topic has an article"}
            description={
              q
                ? "Try a different title."
                : view === "written"
                  ? "Switch to “Not yet written” and draft your first article."
                  : "Nice work. Research more topics to keep the content pipeline going."
            }
          />
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {sorted.map((a) =>
            view === "written" ? <WrittenRow key={a.id ?? a.topic_id} websiteId={websiteId} article={a} /> : <UnwrittenRow key={a.topic_id} websiteId={websiteId} item={a} />,
          )}
        </Card>
      )}
    </div>
  );
}

function WrittenRow({ websiteId, article }: { websiteId: number; article: ArticleItem }) {
  return (
    <Link to={`/c/${websiteId}/articles/${article.id}`} className="group flex items-center gap-4 p-4 transition hover:bg-surface-2/50 sm:px-5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-ink group-hover:text-brand-700 dark:group-hover:text-brand-300">{article.title}</h3>
        <p className="mt-0.5 text-xs text-ink-3" title={formatDate(article.created_at, true)}>
          Created {timeAgo(article.created_at)}
        </p>
      </div>
      <Badge tone={articleStatusTone(article.status)} className="capitalize">
        {article.status ?? "draft"}
      </Badge>
      <ArrowRight className="hidden size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink sm:block" />
    </Link>
  );
}

function UnwrittenRow({ websiteId, item }: { websiteId: number; item: ArticleItem }) {
  const write = useWriteArticle(websiteId, item.topic_id);
  const writing = useIsWriting(item.topic_id);
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-3">
          <Lightbulb className="size-4" />
        </span>
        <h3 className="min-w-0 text-sm font-medium text-ink">{item.title}</h3>
      </div>
      <Button size="sm" variant={writing ? "subtle" : "secondary"} icon={PenLine} loading={writing} onClick={() => write.mutate()} className="self-end sm:self-auto">
        {writing ? "Writing…" : "Write article"}
      </Button>
    </div>
  );
}
