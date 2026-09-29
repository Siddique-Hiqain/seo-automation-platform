import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpDown,
  ChevronDown,
  FileCheck2,
  Lightbulb,
  PenLine,
  Search,
  SearchX,
  Sparkles,
} from "lucide-react";
import { Badge, Button, Card, Dialog, EmptyState, ErrorState, Skeleton, Spinner } from "../ui";
import { useAgentRunReason, useAgents, useArticles, useIsWriting, useTopics, useWriteArticle } from "../../lib/queries";
import { stepLabel, usePipeline } from "../../lib/pipeline";
import type { ArticleItem, Topic } from "../../lib/types";
import { cn } from "../../lib/utils";

type Sort = "priority" | "value" | "title";
const VALUE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const valueRank = (v: string | null) => VALUE_RANK[(v ?? "").toLowerCase()] ?? 0;

export const intentTone = (intent: string) => {
  const i = intent.toLowerCase();
  if (i.includes("transaction")) return "success" as const;
  if (i.includes("commercial")) return "warning" as const;
  if (i.includes("navigat")) return "neutral" as const;
  return "info" as const;
};

const valueTone = (v: string | null) =>
  valueRank(v) === 3 ? ("brand" as const) : valueRank(v) === 2 ? ("violet" as const) : ("neutral" as const);

/** Same thresholds the backend uses in graphs/topic_scoring.py */
const priorityLevel = (score: number) => (score >= 80 ? "High" : score >= 50 ? "Medium" : "Low");

export function TopicsTab({ websiteId }: { websiteId: number }) {
  const { data, isLoading, error, refetch } = useTopics(websiteId);
  const articles = useArticles(websiteId);
  const pipeline = usePipeline(websiteId);
  const agents = useAgents(websiteId);

  const [query, setQuery] = useState("");
  const [intent, setIntent] = useState("all");
  const [value, setValue] = useState("all");
  const [sort, setSort] = useState<Sort>("priority");
  const [confirmMore, setConfirmMore] = useState(false);

  const topics = data?.topics ?? [];
  const writtenByTopic = useMemo(() => {
    const m = new Map<number, ArticleItem>();
    articles.data?.written.forEach((a) => m.set(a.topic_id, a));
    return m;
  }, [articles.data]);

  const intents = useMemo(() => [...new Set(topics.map((t) => t.search_intent).filter(Boolean))], [topics]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return topics
      .filter(
        (t) =>
          (intent === "all" || t.search_intent === intent) &&
          (value === "all" || (t.business_value ?? "").toLowerCase() === value) &&
          (!q || t.title.toLowerCase().includes(q) || t.keyword_ideas?.some((k) => k.toLowerCase().includes(q))),
      )
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title);
        if (sort === "value") return valueRank(b.business_value) - valueRank(a.business_value);
        return (b.priority_score ?? -1) - (a.priority_score ?? -1) || valueRank(b.business_value) - valueRank(a.business_value);
      });
  }, [topics, query, intent, value, sort]);

  // "More topics" = topic research agent, then keyword metrics and scoring for the new batch.
  const moreTopics = () => agents.mutate({ steps: ["topics", "keywords", "score"], reason: "more-topics" });
  const busy = pipeline.running;
  const researchingMore = useAgentRunReason(websiteId) === "more-topics";

  if (isLoading) return <TopicsSkeleton />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  if (topics.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Lightbulb}
          title="Topics are on the way"
          description="Our agents research 20 topics for this business during setup. They'll appear here as soon as they're ready."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1 xl:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            className="input pl-10"
            placeholder="Search topics or keywords…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search topics"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <select value={intent} onChange={(e) => setIntent(e.target.value)} className="input h-10 py-0 text-sm sm:w-auto" aria-label="Filter by search intent">
            <option value="all">All intents</option>
            {intents.map((i) => (
              <option key={i} value={i} className="capitalize">
                {i}
              </option>
            ))}
          </select>
          <select value={value} onChange={(e) => setValue(e.target.value)} className="input h-10 py-0 text-sm sm:w-auto" aria-label="Filter by business value">
            <option value="all">Any value</option>
            <option value="high">High value</option>
            <option value="medium">Medium value</option>
            <option value="low">Low value</option>
          </select>
          <div className="relative col-span-2 sm:col-span-1">
            <ArrowUpDown className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-3" />
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="input h-10 py-0 pl-8 text-sm sm:w-auto" aria-label="Sort topics">
              <option value="priority">Sort: Priority</option>
              <option value="value">Sort: Business value</option>
              <option value="title">Sort: Title</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 xl:ml-auto">
          <Button
            variant="secondary"
            icon={Sparkles}
            loading={researchingMore}
            disabled={busy}
            onClick={() => setConfirmMore(true)}
            className="max-xl:flex-1"
          >
            More topics
          </Button>
        </div>
      </div>

      {researchingMore && pipeline.currentStep && (
        <div className="flex items-center gap-2.5 rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3 text-sm text-brand-700">
          <Spinner className="size-4" />
          {stepLabel(pipeline.currentStep)}… New topics will appear with their scores when the agents finish.
        </div>
      )}

      <p className="text-xs text-ink-3">
        Showing {visible.length} of {topics.length} topics · {writtenByTopic.size} written
      </p>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={SearchX} title="No topics match your filters" description="Try clearing the search or filters." />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((t, i) => (
            <TopicCard
              key={t.id ?? i}
              topic={t}
              websiteId={websiteId}
              article={t.id != null ? writtenByTopic.get(t.id) : undefined}
            />
          ))}
        </div>
      )}

      <Dialog
        open={confirmMore}
        onClose={() => setConfirmMore(false)}
        title="Research more topics?"
        description="Our agents will research 20 more topics, fetch their keyword metrics from DataForSEO and score them. This takes a few minutes."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmMore(false)}>
              Cancel
            </Button>
            <Button
              icon={Sparkles}
              onClick={() => {
                setConfirmMore(false);
                moreTopics();
              }}
            >
              Research topics
            </Button>
          </>
        }
      />
    </div>
  );
}

function ScoreMeter({ score }: { score: number | null | undefined }) {
  if (score == null)
    return (
      <div className="text-right">
        <div className="text-xs text-ink-3">Not scored</div>
      </div>
    );
  const level = priorityLevel(score);
  const color =
    level === "High" ? "bg-emerald-500" : level === "Medium" ? "bg-amber-500" : "bg-slate-400";
  return (
    <div className="w-full sm:w-28">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-ink-3">{level} priority</span>
        <span className="text-sm font-semibold tabular-nums text-ink">{Math.round(score)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  );
}

function TopicCard({ topic, websiteId, article }: { topic: Topic; websiteId: number; article?: ArticleItem }) {
  const [open, setOpen] = useState(false);
  const topicId = topic.id ?? -1;
  const write = useWriteArticle(websiteId, topicId);
  const writing = useIsWriting(topicId);

  return (
    <Card className={cn("transition-colors", writing && "border-brand-500/40")}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {topic.search_intent && (
              <Badge tone={intentTone(topic.search_intent)} className="capitalize">
                {topic.search_intent}
              </Badge>
            )}
            {topic.business_value && <Badge tone={valueTone(topic.business_value)}>{topic.business_value} value</Badge>}
            {article && (
              <Badge tone="success">
                <FileCheck2 className="size-3" /> Written
              </Badge>
            )}
          </div>
          <h3 className="mt-2 text-[15px] leading-snug font-semibold text-ink">{topic.title}</h3>
          {topic.keyword_ideas?.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {topic.keyword_ideas.map((k) => (
                <span key={k} className="rounded-md border border-line bg-surface-2/60 px-2 py-0.5 font-mono text-[11px] text-ink-2">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <div className="flex-1 sm:flex-none">
            <ScoreMeter score={topic.priority_score} />
          </div>
          {article?.id ? (
            <Link
              to={`/c/${websiteId}/articles/${article.id}`}
              className="inline-flex h-9 w-32 items-center justify-center gap-1.5 rounded-lg border border-line-strong px-3 text-xs font-medium text-ink transition hover:bg-surface-2"
            >
              <FileCheck2 className="size-3.5" /> Open article
            </Link>
          ) : (
            <Button size="sm" icon={PenLine} loading={writing} disabled={topic.id == null} onClick={() => write.mutate()} className="h-9 w-32">
              {writing ? "Writing…" : "Write article"}
            </Button>
          )}
        </div>
      </div>

      {writing && (
        <div className="flex items-center gap-2 border-t border-line bg-brand-500/5 px-5 py-2.5 text-xs text-brand-700 dark:text-brand-300">
          <Spinner className="size-3.5" />
          Drafting a long-form article with meta tags and FAQs. This can take a couple of minutes.
        </div>
      )}

      {topic.reasoning && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full cursor-pointer items-center gap-1.5 border-t border-line px-5 py-2.5 text-xs font-medium text-ink-3 transition hover:text-ink"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            Why this topic
          </button>
          {open && <p className="animate-fade-in px-5 pb-4 text-sm leading-relaxed text-ink-2">{topic.reasoning}</p>}
        </>
      )}
    </Card>
  );
}

function TopicsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full max-w-md" />
      {Array.from({ length: 5 }, (_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-5 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
        </Card>
      ))}
    </div>
  );
}
