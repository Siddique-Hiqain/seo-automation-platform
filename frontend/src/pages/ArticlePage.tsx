import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Code2,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Globe,
  GripVertical,
  HelpCircle,
  Plus,
  Save,
  SquarePen,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { Badge, Button, ButtonLink, Card, Dialog, ErrorState, ProgressRing, Skeleton } from "../components/ui";
import { Markdown } from "../components/Markdown";
import { articleStatusTone } from "../components/website/ArticlesTab";
import { NotFoundPage } from "./NotFoundPage";
import { ApiError } from "../lib/api";
import {
  errorMessage,
  useArticle,
  usePublishArticle,
  useTopics,
  useUpdateArticle,
  useWebsite,
  useWordPressIntegration,
} from "../lib/queries";
import { analyzeArticle, LIMITS, normalizeFaq, slugify, toExportDocument, type Check, type Faq } from "../lib/seo";
import type { ArticleDetail } from "../lib/types";
import { cn, formatDate, hostname, isHtml, plainText, readingTime, startsWithH1, wordCount } from "../lib/utils";

interface Draft {
  title: string;
  metaTitle: string;
  metaDescription: string;
  content: string;
  faq: Faq[];
}

/** Plain text with paragraph breaks kept, for pasting into editors that don't accept HTML. */
const readableText = (content: string) =>
  plainText(content.replace(/<\/(p|h[1-6]|li|div)>/gi, "\n\n"))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();

const fromArticle = (a: ArticleDetail): Draft => ({
  title: a.title ?? "",
  metaTitle: a.meta_title ?? "",
  metaDescription: a.meta_description ?? "",
  content: a.content ?? "",
  faq: normalizeFaq(a.faq),
});

export function ArticlePage() {
  const id = Number(useParams().articleId);
  const { data: article, isLoading, error, refetch } = useArticle(id);

  if (!Number.isFinite(id)) return <NotFoundPage title="Article not found" />;
  if (error instanceof ApiError && error.status === 404)
    return <NotFoundPage title="Article not found" description="This article doesn't exist or was deleted." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading || !article) return <EditorSkeleton />;

  // Remount the editor when the article changes so the draft resets cleanly.
  return <Editor key={article.id} article={article} />;
}

function Editor({ article }: { article: ArticleDetail }) {
  const website = useWebsite(article.website_id).data;
  const topics = useTopics(article.website_id).data?.topics;
  const topic = topics?.find((t) => t.id === article.topic_id);
  const update = useUpdateArticle(article.id);
  const integration = useWordPressIntegration(article.website_id);
  const publish = usePublishArticle(article.id, article.website_id);

  const [saved, setSaved] = useState<Draft>(() => fromArticle(article));
  const [draft, setDraft] = useState<Draft>(saved);
  const [mode, setMode] = useState<"preview" | "write">("preview");
  const [keyword, setKeyword] = useState<string>("");
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!keyword && topic?.keyword_ideas?.[0]) setKeyword(topic.keyword_ideas[0]);
  }, [topic, keyword]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = useCallback(() => {
    if (!dirty || update.isPending) return;
    const payload = {
      title: draft.title,
      meta_title: draft.metaTitle,
      meta_description: draft.metaDescription,
      content: draft.content,
      faq: draft.faq.filter((f) => f.question.trim() || f.answer.trim()),
    };
    update.mutate(payload, {
      onSuccess: () => {
        setSaved(draft);
        toast.success("Article saved");
      },
      onError: (e) => toast.error(`Couldn't save: ${errorMessage(e)}`),
    });
  }, [dirty, draft, update]);

  // Ctrl/Cmd + S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Guard against losing edits: browser close/refresh and in-app navigation.
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);

  const analysis = useMemo(() => analyzeArticle({ ...draft, keyword }), [draft, keyword]);
  const words = wordCount(draft.content);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied to clipboard`);
    } catch {
      toast.error("Clipboard access was blocked by the browser");
    }
  };

  const copyHtml = () => {
    if (isHtml(draft.content)) {
      copy(draft.content, "HTML");
      return;
    }
    if (!previewRef.current) {
      setMode("preview");
      toast.info("Switched to preview. Click “Copy HTML” again.");
      return;
    }
    copy(previewRef.current.innerHTML, "HTML");
  };

  const download = () => {
    const doc = toExportDocument(draft);
    const blob = new Blob([doc.text], { type: `${doc.mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(draft.title)}.${doc.ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const backTo = `/c/${article.website_id}/articles`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link to={backTo} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-ink-3 transition hover:text-ink">
          <ChevronLeft className="size-4" /> Back to articles
        </Link>
        <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={articleStatusTone(article.status)} className="capitalize">
                {article.status}
              </Badge>
              {dirty ? (
                <Badge tone="warning" dot>
                  Unsaved changes
                </Badge>
              ) : (
                <Badge tone="success">
                  <CheckCircle2 className="size-3" /> Saved
                </Badge>
              )}
            </div>
            <h1 className="mt-2 text-xl leading-tight font-semibold tracking-tight text-ink sm:text-2xl">
              {draft.title || "Untitled article"}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <FileText className="size-4" /> {words.toLocaleString()} words
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> {readingTime(draft.content)} min read
              </span>
              <span>Created {formatDate(article.created_at)}</span>
              {article.wp_link ? (
                <a
                  href={article.wp_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-800"
                >
                  View in WordPress <ExternalLink className="size-3.5" />
                </a>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={Copy} onClick={() => copy(readableText(draft.content), "Text")}>
              Copy text
            </Button>
            <Button variant="secondary" icon={Code2} onClick={copyHtml}>
              Copy HTML
            </Button>
            <Button variant="secondary" icon={Download} onClick={download} title="Download with meta tags and FAQs">
              Export
            </Button>
            <Button icon={Save} onClick={save} loading={update.isPending} disabled={!dirty} className="max-sm:flex-1">
              Save changes
            </Button>
            {integration.isLoading ? (
              <Button icon={Send} disabled>
                Checking WordPress
              </Button>
            ) : integration.data ? (
              <>
                <Button
                  variant="secondary"
                  icon={Send}
                  onClick={() => publish.mutate("draft")}
                  loading={publish.isPending}
                  disabled={dirty}
                  title={dirty ? "Save your changes before sending this article" : undefined}
                >
                  {article.wp_post_id ? "Update draft" : "Send draft"}
                </Button>
                <Button
                  icon={Globe}
                  onClick={() => {
                    if (window.confirm("Publish this article live on your WordPress site now?")) {
                      publish.mutate("publish");
                    }
                  }}
                  loading={publish.isPending}
                  disabled={dirty}
                  title={dirty ? "Save your changes before publishing this article" : "Publish live to WordPress"}
                >
                  {article.wp_post_id ? "Publish live" : "Publish to WordPress"}
                </Button>
              </>
            ) : (
              <ButtonLink to={`/c/${article.website_id}/settings/integrations`} icon={Send}>
                Connect WordPress
              </ButtonLink>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <h2 className="text-sm font-semibold text-ink">Article</h2>
              <div className="inline-flex rounded-xl border border-line bg-surface-2/60 p-1">
                {(
                  [
                    ["preview", "Preview", Eye],
                    ["write", "Edit", SquarePen],
                  ] as const
                ).map(([v, label, Icon]) => (
                  <button
                    key={v}
                    onClick={() => setMode(v)}
                    className={cn(
                      "flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium transition sm:flex-none",
                      mode === v ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2",
                    )}
                  >
                    <Icon className="size-4" /> {label}
                  </button>
                ))}
              </div>
            </div>

            {mode === "write" ? (
              <div className="space-y-4 p-4 sm:p-5">
                <Field label="Title" htmlFor="title">
                  <input id="title" className="input text-base font-medium" value={draft.title} onChange={(e) => set("title", e.target.value)} />
                </Field>
                <Field label="Content" htmlFor="content" hint="HTML or Markdown. Both render in the preview.">
                  <AutoTextarea
                    id="content"
                    value={draft.content}
                    onChange={(v) => set("content", v)}
                    className="input min-h-[480px] resize-y font-mono text-[13px] leading-relaxed"
                  />
                </Field>
              </div>
            ) : (
              <article className="px-5 py-6 sm:px-10 sm:py-10">
                {!startsWithH1(draft.content) && (
                  <h1 className="mb-6 text-2xl leading-tight font-bold tracking-tight text-ink sm:text-3xl">{draft.title}</h1>
                )}
                {draft.content.trim() ? (
                  <Markdown
                    ref={previewRef}
                    className="prose-base prose-h1:text-3xl prose-h1:leading-tight sm:prose-lg sm:prose-h1:text-4xl"
                  >
                    {draft.content}
                  </Markdown>
                ) : (
                  <p className="text-sm text-ink-3 italic">No content yet. Switch to Edit to start writing.</p>
                )}
              </article>
            )}
          </Card>

          <FaqEditor faq={draft.faq} onChange={(f) => set("faq", f)} />
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-ink">Search appearance</h2>
            <div className="mt-4 space-y-4">
              <Field label="Meta title" htmlFor="meta-title" counter={<Counter value={draft.metaTitle.length} ideal={LIMITS.metaTitle.ideal} />}>
                <input id="meta-title" className="input" value={draft.metaTitle} onChange={(e) => set("metaTitle", e.target.value)} />
                <LengthBar value={draft.metaTitle.length} ideal={LIMITS.metaTitle.ideal} />
              </Field>
              <Field
                label="Meta description"
                htmlFor="meta-desc"
                counter={<Counter value={draft.metaDescription.length} ideal={LIMITS.metaDescription.ideal} />}
              >
                <AutoTextarea id="meta-desc" value={draft.metaDescription} onChange={(v) => set("metaDescription", v)} className="input min-h-20 resize-none" />
                <LengthBar value={draft.metaDescription.length} ideal={LIMITS.metaDescription.ideal} />
              </Field>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-surface p-4">
              <p className="mb-2 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Google preview</p>
              <div className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-surface-2 text-[10px] font-bold text-ink-2">
                  {(website ? hostname(website.url) : "S")[0].toUpperCase()}
                </span>
                <div className="min-w-0 leading-tight">
                  <div className="truncate text-xs text-ink">{website ? hostname(website.url) : "example.com"}</div>
                  <div className="truncate text-[11px] text-ink-3">
                    {website ? hostname(website.url) : "example.com"} › {slugify(draft.title)}
                  </div>
                </div>
              </div>
              <div className="mt-2 line-clamp-2 text-[17px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
                {draft.metaTitle || draft.title || "Page title"}
              </div>
              <div className="mt-1 line-clamp-2 text-[13px] leading-snug text-ink-2">
                {draft.metaDescription || "Add a meta description to control how this page appears in search results."}
              </div>
            </div>
          </Card>

          <SeoScore checks={analysis.checks} score={analysis.score} keyword={keyword} keywords={topic?.keyword_ideas ?? []} onKeyword={setKeyword} />
        </aside>
      </div>

      <Dialog
        open={blocker.state === "blocked"}
        onClose={() => blocker.reset?.()}
        title="Discard unsaved changes?"
        description="You have edits that haven't been saved. If you leave now they'll be lost."
        footer={
          <>
            <Button variant="secondary" onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button variant="danger" onClick={() => blocker.proceed?.()}>
              Discard & leave
            </Button>
          </>
        }
      />
    </div>
  );
}

/* ------------------------------ Pieces ------------------------------ */

function Field({
  label,
  htmlFor,
  hint,
  counter,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  counter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
          {label}
        </label>
        {counter}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  className,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, []);
  useEffect(fit, [value, fit]);
  // Re-measure once web fonts load and whenever the width changes (text re-wraps).
  useEffect(() => {
    document.fonts?.ready.then(fit);
    const ro = new ResizeObserver(fit);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [fit]);
  return <textarea id={id} ref={ref} value={value} onChange={(e) => onChange(e.target.value)} className={className} />;
}

const lengthState = (n: number, [lo, hi]: readonly [number, number]) =>
  n === 0 ? "empty" : n < lo * 0.6 || n > hi * 1.15 ? "bad" : n < lo || n > hi ? "ok" : "good";

function Counter({ value, ideal }: { value: number; ideal: readonly [number, number] }) {
  const s = lengthState(value, ideal);
  return (
    <span
      className={cn(
        "text-xs font-medium tabular-nums",
        s === "good" && "text-emerald-600 dark:text-emerald-400",
        s === "ok" && "text-amber-600 dark:text-amber-400",
        s === "bad" && "text-rose-600 dark:text-rose-400",
        s === "empty" && "text-ink-3",
      )}
    >
      {value} / {ideal[1]}
    </span>
  );
}

function LengthBar({ value, ideal }: { value: number; ideal: readonly [number, number] }) {
  const s = lengthState(value, ideal);
  const pct = Math.min(100, (value / ideal[1]) * 100);
  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
      <div
        className={cn(
          "h-full rounded-full transition-all",
          s === "good" ? "bg-emerald-500" : s === "ok" ? "bg-amber-500" : "bg-rose-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function SeoScore({
  checks,
  score,
  keyword,
  keywords,
  onKeyword,
}: {
  checks: Check[];
  score: number;
  keyword: string;
  keywords: string[];
  onKeyword: (k: string) => void;
}) {
  const label = score >= 80 ? "Great" : score >= 60 ? "Good" : score >= 40 ? "Needs work" : "Poor";
  return (
    <Card className="p-5">
      <div className="flex items-center gap-4">
        <div className="relative grid place-items-center">
          <ProgressRing value={score} size={60} stroke={5} />
          <span className="absolute text-sm font-bold tabular-nums text-ink">{score}</span>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">SEO score</h2>
          <p className="text-xs text-ink-3">{label}. Updates as you edit.</p>
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="focus-kw" className="mb-1.5 block text-xs font-medium text-ink-2">
          Focus keyword
        </label>
        {keywords.length > 0 ? (
          <select id="focus-kw" value={keyword} onChange={(e) => onKeyword(e.target.value)} className="input h-9 py-0 text-sm">
            {keywords.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        ) : (
          <input id="focus-kw" className="input h-9 py-0 text-sm" placeholder="e.g. emergency plumber" value={keyword} onChange={(e) => onKeyword(e.target.value)} />
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {checks.map((c) => (
          <li key={c.label} className="flex gap-2.5">
            {c.state === "pass" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
            ) : c.state === "warn" ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{c.label}</div>
              <div className="text-xs wrap-break-word text-ink-3">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function FaqEditor({ faq, onChange }: { faq: Faq[]; onChange: (f: Faq[]) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const update = (i: number, patch: Partial<Faq>) => onChange(faq.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const remove = (i: number) => {
    onChange(faq.filter((_, j) => j !== i));
    setEditing(null);
  };
  const add = () => {
    onChange([...faq, { question: "", answer: "" }]);
    setEditing(faq.length);
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <HelpCircle className="size-4 text-ink-3" />
          <h2 className="text-sm font-semibold text-ink">FAQs</h2>
          <span className="text-xs text-ink-3 tabular-nums">{faq.length}</span>
        </div>
        <Button size="sm" variant="secondary" icon={Plus} onClick={add}>
          Add question
        </Button>
      </div>
      {faq.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-3">No FAQs yet. Adding a few helps you win “People also ask” spots.</p>
      ) : (
        <ul className="divide-y divide-line">
          {faq.map((f, i) => (
            <li key={i} className="group px-4 py-4 sm:px-5">
              {editing === i ? (
                <div className="space-y-2.5">
                  <input
                    autoFocus
                    className="input font-medium"
                    placeholder="Question"
                    value={f.question}
                    onChange={(e) => update(i, { question: e.target.value })}
                  />
                  <AutoTextarea value={f.answer} onChange={(v) => update(i, { answer: v })} className="input min-h-20 resize-none" />
                  <div className="flex justify-between">
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => remove(i)} className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400">
                      Remove
                    </Button>
                    <Button size="sm" onClick={() => setEditing(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <GripVertical className="mt-0.5 hidden size-4 shrink-0 text-ink-3/50 sm:block" />
                  <button onClick={() => setEditing(i)} className="min-w-0 flex-1 cursor-pointer text-left">
                    <div className="text-sm font-semibold text-ink">{f.question || <span className="text-ink-3 italic">Untitled question</span>}</div>
                    <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-ink-2">{f.answer || <span className="italic">No answer yet</span>}</p>
                  </button>
                  <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                    <Button size="icon" variant="ghost" aria-label="Edit question" onClick={() => setEditing(i)} className="size-8">
                      <SquarePen className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="Remove question" onClick={() => remove(i)} className="size-8 hover:text-rose-600">
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-40" />
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="space-y-4 p-8">
          <Skeleton className="h-8 w-2/3" />
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-3/5" : "w-full")} />
          ))}
        </Card>
        <Card className="space-y-4 p-5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-28 w-full" />
        </Card>
      </div>
    </div>
  );
}
