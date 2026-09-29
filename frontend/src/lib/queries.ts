import { useIsMutating, useMutation, useMutationState, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "./api";
import { recordRun, setAutopilotStep, type StepKey } from "./runLog";
import type { ArticleUpdateRequest, WordPressCredentials } from "./types";

export const keys = {
  websites: ["websites"] as const,
  profile: (id: number) => ["website", id, "profile"] as const,
  topics: (id: number) => ["website", id, "topics"] as const,
  articles: (id: number) => ["website", id, "articles"] as const,
  article: (id: number) => ["article", id] as const,
  wordpressIntegration: (id: number) => ["website", id, "wordpress-integration"] as const,
};

export const errorMessage = (e: unknown) =>
  e instanceof Error ? e.message : "Something went wrong";

/* ----------------------------- Queries ----------------------------- */

export function useWebsites() {
  return useQuery({ queryKey: keys.websites, queryFn: api.listWebsites });
}

export function useWebsite(id: number) {
  const q = useWebsites();
  return { ...q, data: q.data?.find((w) => w.id === id) };
}

/** Resolves to `null` when the profile hasn't been generated yet (backend answers 404). */
export async function fetchProfile(id: number) {
  try {
    return await api.getProfile(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function useProfile(id: number) {
  return useQuery({ queryKey: keys.profile(id), queryFn: () => fetchProfile(id) });
}

export function useTopics(id: number) {
  return useQuery({ queryKey: keys.topics(id), queryFn: () => api.getTopics(id) });
}

export function useArticles(id: number) {
  return useQuery({ queryKey: keys.articles(id), queryFn: () => api.listArticles(id) });
}

export function useArticle(id: number) {
  return useQuery({ queryKey: keys.article(id), queryFn: () => api.getArticle(id) });
}

export async function fetchWordPressIntegration(websiteId: number) {
  try {
    return await api.getWordPressIntegration(websiteId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function useWordPressIntegration(websiteId: number) {
  return useQuery({
    queryKey: keys.wordpressIntegration(websiteId),
    queryFn: () => fetchWordPressIntegration(websiteId),
  });
}

export function useConnectWordPress(websiteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (credentials: WordPressCredentials) => api.connectWordPress(websiteId, credentials),
    onSuccess: (integration) => {
      qc.setQueryData(keys.wordpressIntegration(websiteId), integration);
      toast.success("WordPress connected. You can now publish articles.");
    },
  });
}

export function useDisconnectWordPress(websiteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.disconnectWordPress(websiteId),
    onSuccess: () => {
      qc.setQueryData(keys.wordpressIntegration(websiteId), null);
      toast.success("WordPress disconnected from Hiqain.");
    },
  });
}

/* ---------------------------- Mutations ---------------------------- */

export function useCreateWebsite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createWebsite,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.websites }),
  });
}

/* ------------------------------ Agents ------------------------------ */

/** Pages the crawl agent fetches (backend allows 1–25). */
const CRAWL_MAX_PAGES = 10;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

interface StepResult {
  summary: string;
  invalidate: readonly (readonly unknown[])[];
}

/** One backend agent per step: runs the request and describes the outcome. */
function agentRunners(id: number, qc: QueryClient): Record<StepKey, () => Promise<StepResult>> {
  return {
    crawl: async () => {
      const r = await api.crawl(id, CRAWL_MAX_PAGES);
      if (r.pages_crawled === 0) throw new Error("No pages could be crawled. Check that the website is reachable.");
      return {
        summary: `Crawled ${plural(r.pages_crawled, "page")}${r.pages_failed ? ` · ${r.pages_failed} failed` : ""}`,
        invalidate: [keys.websites],
      };
    },
    chunk: async () => {
      const r = await api.chunk(id);
      return { summary: `Created ${plural(r.chunks_created, "chunk")} from ${plural(r.pages_chunked, "page")}`, invalidate: [] };
    },
    embed: async () => {
      const r = await api.embed(id);
      return { summary: `Indexed ${plural(r.chunks_embedded, "chunk")}`, invalidate: [] };
    },
    profile: async () => {
      const r = await api.generateProfile(id);
      qc.setQueryData(keys.profile(id), r);
      return { summary: "Business profile ready", invalidate: [keys.profile(id)] };
    },
    topics: async () => {
      const r = await api.researchTopics(id);
      return { summary: `Generated ${plural(r.topics_generated, "topic")}`, invalidate: [keys.topics(id), keys.articles(id)] };
    },
    keywords: async () => {
      const r = await api.researchKeywords(id);
      return { summary: `Fetched metrics for ${plural(r.keywords_created, "keyword")}`, invalidate: [keys.topics(id)] };
    },
    score: async () => {
      const r = await api.scoreTopics(id);
      return { summary: `Scored ${plural(r.topics_scored, "topic")}`, invalidate: [keys.topics(id)] };
    },
  };
}

export const agentsMutationKey = (websiteId: number) => ["agents", websiteId] as const;

export type AgentRunReason = "setup" | "more-topics";

/**
 * Runs the backend agents in order, stopping at the first failure. Used for the
 * automatic setup of a new business and for "More topics". Callbacks live on the
 * mutation (not on `mutate`), so they still fire if the user navigates away.
 */
export function useAgents(websiteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: agentsMutationKey(websiteId),
    mutationFn: async ({ steps }: { steps: StepKey[]; reason: AgentRunReason }) => {
      const runners = agentRunners(websiteId, qc);
      try {
        for (const step of steps) {
          setAutopilotStep(websiteId, step);
          // Crawling flips the website status to "crawling" on the server.
          if (step === "crawl") setTimeout(() => qc.invalidateQueries({ queryKey: keys.websites }), 400);
          try {
            const { summary, invalidate } = await runners[step]();
            recordRun(websiteId, step, { ok: true, summary });
            await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
          } catch (e) {
            recordRun(websiteId, step, { ok: false, summary: errorMessage(e) });
            throw e;
          }
        }
      } finally {
        setAutopilotStep(websiteId, null);
      }
    },
    onSuccess: (_, { reason }) =>
      toast.success(reason === "setup" ? "Setup complete. Your topics are ready." : "New topics are researched and scored."),
    onError: (e) => {
      toast.error(errorMessage(e));
      qc.invalidateQueries({ queryKey: keys.websites });
    },
  });
}

/** Why the agents are currently running for this business, or null when idle. */
export function useAgentRunReason(websiteId: number): AgentRunReason | null {
  const reasons = useMutationState({
    filters: { mutationKey: agentsMutationKey(websiteId), status: "pending" },
    select: (m) => (m.state.variables as { reason?: AgentRunReason } | undefined)?.reason ?? null,
  });
  return reasons[0] ?? null;
}

export const writeMutationKey = (topicId: number) => ["write", topicId] as const;

export function useWriteArticle(websiteId: number, topicId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: writeMutationKey(topicId),
    mutationFn: () => api.writeArticle(topicId),
    onSuccess: (r) => {
      toast.success(`Article drafted: ${r.article.title ?? "Untitled"}`);
      qc.invalidateQueries({ queryKey: keys.articles(websiteId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function useIsWriting(topicId: number) {
  return useIsMutating({ mutationKey: writeMutationKey(topicId) }) > 0;
}

export function useUpdateArticle(articleId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ArticleUpdateRequest) => api.updateArticle(articleId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.article(articleId) });
      qc.invalidateQueries({ queryKey: ["website"] });
    },
  });
}

export function usePublishArticle(articleId: number, websiteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status: "draft" | "publish") => api.publishArticle(articleId, status),
    onSuccess: (result) => {
      toast.success(result.status === "publish" ? "Published to WordPress" : "Draft sent to WordPress");
      qc.invalidateQueries({ queryKey: keys.article(articleId) });
      qc.invalidateQueries({ queryKey: keys.articles(websiteId) });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
