import { useIsMutating } from "@tanstack/react-query";
import { agentsMutationKey, useArticles, useProfile, useTopics, useWebsite } from "./queries";
import { useAutopilotStep, useRunLog, type StepKey } from "./runLog";

/** The backend agents that set up a business, in the order they run. */
export const STEPS: { key: StepKey; label: string }[] = [
  { key: "crawl", label: "Crawling the website" },
  { key: "chunk", label: "Reading page content" },
  { key: "embed", label: "Building the knowledge base" },
  { key: "profile", label: "Understanding the business" },
  { key: "topics", label: "Researching topics" },
  { key: "keywords", label: "Fetching keyword metrics" },
  { key: "score", label: "Scoring topics" },
];

export const stepLabel = (k: StepKey) => STEPS.find((s) => s.key === k)?.label ?? "Working";

/**
 * Setup progress for one business. The backend only stores `website.status`,
 * so each agent's completion is inferred from server data first and from the
 * local run log second.
 */
export function usePipeline(websiteId: number) {
  const websiteQuery = useWebsite(websiteId);
  const website = websiteQuery.data;
  const profile = useProfile(websiteId);
  const topics = useTopics(websiteId);
  const articles = useArticles(websiteId);
  const log = useRunLog(websiteId);
  const currentStep = useAutopilotStep(websiteId);
  const running = useIsMutating({ mutationKey: agentsMutationKey(websiteId) }) > 0;

  const topicList = topics.data?.topics ?? [];
  const hasProfile = !!profile.data;
  const hasTopics = topicList.length > 0;
  const hasScores = topicList.some((t) => t.priority_score != null);

  const done: Record<StepKey, boolean> = {
    score: hasScores,
    keywords: hasScores || !!log.keywords?.ok,
    topics: hasTopics,
    profile: hasProfile,
    embed: hasProfile || hasTopics || !!log.embed?.ok,
    chunk: false,
    crawl: false,
  };
  done.chunk = done.embed || !!log.chunk?.ok;
  done.crawl = website?.status === "crawled" || done.chunk;

  const remaining = STEPS.map((s) => s.key).filter((k) => !done[k]);
  const completed = STEPS.length - remaining.length;

  // The next agent's last attempt failed (and it hasn't succeeded since).
  const next = remaining[0];
  const failed = !running && next && log[next]?.ok === false ? { step: next, message: log[next]!.summary } : null;

  return {
    completed,
    total: STEPS.length,
    progress: Math.round((completed / STEPS.length) * 100),
    remaining,
    isComplete: remaining.length === 0,
    running,
    currentStep: running ? currentStep : null,
    failed,
    hasTopics,
    counts: {
      topics: topicList.length,
      scored: topicList.filter((t) => t.priority_score != null).length,
      written: articles.data?.written.length ?? 0,
      unwritten: articles.data?.unwritten.length ?? 0,
    },
    loading: websiteQuery.isLoading || profile.isLoading || topics.isLoading || articles.isLoading,
  };
}
