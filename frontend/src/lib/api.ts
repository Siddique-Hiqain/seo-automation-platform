import type {
  ArticleDetail,
  ArticleListResponse,
  ArticleUpdateRequest,
  ArticleWriterResponse,
  HealthResponse,
  KeywordResearchResponse,
  TopicResearchResponse,
  TopicScoreResponse,
  Website,
  WebsiteChunkResponse,
  WebsiteCrawlResponse,
  WebsiteEmbeddingResponse,
  WebsiteProfileResponse,
  WordPressIntegration,
  WordPressCredentials,
  WordPressPublishResponse,
} from "./types";

// Defaults to the Vite proxy prefix. An empty value or "/" would send requests to the
// Vite server itself (which answers with index.html), so those also fall back to it.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, "") || "/backend";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Turns FastAPI's `detail` (string or validation error list) into a readable message. */
function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => {
          const loc = Array.isArray(d?.loc) ? d.loc.filter((p: unknown) => p !== "body").join(".") : "";
          return loc ? `${loc}: ${d?.msg}` : d?.msg;
        })
        .filter(Boolean)
        .join("; ");
    }
  }
  return fallback;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, "Can't reach the API server. Make sure the backend is running.");
  }

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const fallback =
      res.status === 502 || res.status === 504
        ? "The backend didn't respond. It may be offline or the request timed out."
        : res.status >= 500
          ? "The server hit an unexpected error. Check the backend logs."
          : `Request failed (${res.status})`;
    throw new ApiError(res.status, extractMessage(body, fallback));
  }

  return body as T;
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: "POST", body: data === undefined ? undefined : JSON.stringify(data) });

export const api = {
  health: () => request<HealthResponse>("/health"),
  healthDb: () => request<HealthResponse>("/health/db"),
  healthQdrant: () => request<HealthResponse>("/health/qdrant"),

  listWebsites: () => request<Website[]>("/api/websites"),
  createWebsite: (url: string) => post<Website>("/api/websites", { url }),

  crawl: (id: number, maxPages: number) =>
    post<WebsiteCrawlResponse>(`/api/websites/${id}/crawl?max_pages=${maxPages}`),
  chunk: (id: number) => post<WebsiteChunkResponse>(`/api/websites/${id}/chunk`),
  embed: (id: number) => post<WebsiteEmbeddingResponse>(`/api/websites/${id}/embed`),

  generateProfile: (id: number) => post<WebsiteProfileResponse>(`/api/websites/${id}/profile`),
  getProfile: (id: number) => request<WebsiteProfileResponse>(`/api/websites/${id}/profile`),

  researchTopics: (id: number) => post<TopicResearchResponse>(`/api/websites/${id}/topics/research`),
  getTopics: (id: number) => request<TopicResearchResponse>(`/api/websites/${id}/topics`),
  researchKeywords: (id: number) => post<KeywordResearchResponse>(`/api/websites/${id}/keywords/research`),
  scoreTopics: (id: number) => post<TopicScoreResponse>(`/api/websites/${id}/topics/score`),

  writeArticle: (topicId: number) => post<ArticleWriterResponse>(`/api/websites/topics/${topicId}/write`),
  listArticles: (id: number) => request<ArticleListResponse>(`/api/websites/${id}/articles`),
  getArticle: (articleId: number) => request<ArticleDetail>(`/articles/${articleId}`),
  updateArticle: (articleId: number, data: ArticleUpdateRequest) =>
    request<{ message: string; article_id: number }>(`/articles/${articleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getWordPressIntegration: (websiteId: number) =>
    request<WordPressIntegration>(`/integrations/wordpress/websites/${websiteId}`),
  connectWordPress: (websiteId: number, credentials: WordPressCredentials) =>
    request<WordPressIntegration>(`/integrations/wordpress/websites/${websiteId}`, {
      method: "PUT",
      body: JSON.stringify(credentials),
      cache: "no-store",
    }),
  disconnectWordPress: (websiteId: number) =>
    request<void>(`/integrations/wordpress/websites/${websiteId}`, { method: "DELETE" }),
  publishArticle: (articleId: number, status: "draft" | "publish") =>
    post<WordPressPublishResponse>(`/articles/${articleId}/publish`, { status }),
};
