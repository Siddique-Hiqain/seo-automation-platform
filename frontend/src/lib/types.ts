// Types mirror the Pydantic schemas in backend/app/schemas.

export type WebsiteStatus = "pending" | "crawling" | "crawled" | "failed" | (string & {});

export interface Website {
  id: number;
  url: string;
  status: WebsiteStatus;
  created_at: string;
}

export interface WebsiteCrawlResponse {
  website_id: number;
  pages_crawled: number;
  pages_failed: number;
  page_urls: string[];
}

export interface WebsiteChunkResponse {
  website_id: number;
  pages_chunked: number;
  chunks_created: number;
}

export interface WebsiteEmbeddingResponse {
  website_id: number;
  chunks_embedded: number;
  collection: string;
}

/** Shape requested from the LLM in graphs/website_profile.py — every field may be missing. */
export interface BusinessProfile {
  business_name?: string | null;
  industry?: string | null;
  business_summary?: string | null;
  services?: unknown[] | null;
  service_categories?: unknown[] | null;
  target_audience?: unknown[] | null;
  customer_pain_points?: unknown[] | null;
  unique_selling_points?: unknown[] | null;
  locations?: unknown[] | null;
  business_goals?: unknown[] | null;
  brand_tone?: string | null;
  content_themes?: unknown[] | null;
  seo_opportunities?: unknown[] | null;
  [key: string]: unknown;
}

export interface WebsiteProfileResponse {
  website_id: number;
  profile: BusinessProfile;
}

export interface Topic {
  id?: number;
  title: string;
  keyword_ideas: string[];
  search_intent: string;
  business_value: string | null;
  priority_score?: number | null;
  reasoning: string | null;
}

export interface TopicResearchResponse {
  website_id: number;
  topics_generated: number;
  topics: Topic[];
}

export interface KeywordResearchResponse {
  website_id: number;
  keywords_created: number;
}

export interface TopicScoreResponse {
  website_id: number;
  topics_scored: number;
}

export interface ArticleWriterResponse {
  topic_id: number;
  article: Record<string, unknown> & { id?: number; title?: string };
}

export interface ArticleItem {
  id: number | null;
  topic_id: number;
  title: string;
  status: string | null;
  created_at: string | null;
}

export interface ArticleListResponse {
  written: ArticleItem[];
  unwritten: ArticleItem[];
}

export type FaqItem = { question?: string; answer?: string; q?: string; a?: string } | string;

export interface ArticleDetail {
  id: number;
  website_id: number;
  topic_id: number;
  title: string;
  meta_title: string | null;
  meta_description: string | null;
  content: string;
  faq: FaqItem[] | null;
  status: string;
  wp_post_id: number | null;
  wp_link: string | null;
  created_at: string | null;
}

export interface ArticleUpdateRequest {
  title?: string;
  meta_title?: string;
  meta_description?: string;
  content?: string;
  faq?: FaqItem[];
}

export interface WordPressIntegration {
  id: number;
  website_id: number;
  base_url: string;
  username: string;
  status: string;
  connected_at: string;
}

export interface WordPressCredentials {
  username: string;
  application_password: string;
}

export interface WordPressPublishResponse {
  article_id: number;
  wordpress_post_id: number;
  link: string;
  status: string;
}

export interface HealthResponse {
  status: string;
  [key: string]: string;
}
