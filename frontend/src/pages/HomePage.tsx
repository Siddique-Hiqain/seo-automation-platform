import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Brain, Globe, PenLine, Plus, Sparkles, Target } from "lucide-react";
import { useAddWebsite } from "../components/AppShell";
import { Button, ErrorState, Spinner } from "../components/ui";
import { companyPath, useCompanies, useRememberedCompany } from "../lib/company";

/** "/" — open the last selected business, or welcome a new user. */
export function HomePage() {
  const { companies, isLoading, error, refetch } = useCompanies();
  const remembered = useRememberedCompany();

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading)
    return (
      <div className="grid min-h-[50vh] place-items-center text-ink-3">
        <Spinner className="size-6" />
      </div>
    );
  if (companies.length === 0) return <Welcome />;

  const target = companies.find((c) => c.id === remembered) ?? companies[0];
  return <Navigate to={companyPath.articles(target.id)} replace />;
}

/** Keeps old /websites/:id?tab=… links working. */
export function LegacyWebsiteRedirect() {
  const id = Number(useParams().websiteId);
  const tab = useSearchParams()[0].get("tab");
  if (!Number.isFinite(id)) return <Navigate to="/" replace />;
  const to =
    tab === "articles"
      ? companyPath.articles(id)
      : tab === "topics"
        ? companyPath.topics(id)
        : companyPath.settings(id);
  return <Navigate to={to} replace />;
}

const FLOW = [
  { icon: Globe, title: "Crawl", text: "Pages are fetched and indexed into a searchable knowledge base." },
  { icon: Brain, title: "Understand", text: "AI builds a business profile: services, audience and USPs." },
  { icon: Target, title: "Research", text: "Topics and keywords are discovered, measured and prioritized." },
  { icon: PenLine, title: "Write", text: "Long-form articles with meta tags and FAQs are drafted for you." },
];

function Welcome() {
  const openAdd = useAddWebsite();
  return (
    <div className="space-y-8">
      <div className="card relative overflow-hidden p-8 sm:p-12">
        <div className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 size-72 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300">
            <Sparkles className="size-3.5" /> AI-powered SEO automation
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink sm:text-4xl">
            From website URL to ranked content plan in minutes
          </h1>
          <p className="mt-4 text-base text-ink-2">
            Add your first business. We'll crawl its website, understand what it does, research topics and keywords,
            then draft SEO-optimized articles you can edit and publish.
          </p>
          <Button size="lg" icon={Plus} onClick={openAdd} className="mt-8">
            Add your first business
          </Button>
        </div>
      </div>

      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FLOW.map(({ icon: Icon, title, text }, i) => (
          <li key={title} className="card p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-violet-500 text-white shadow-sm shadow-brand-600/30">
                <Icon className="size-4" />
              </span>
              <div>
                <div className="text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Step {i + 1}</div>
                <div className="text-sm font-semibold text-ink">{title}</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-ink-2">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
