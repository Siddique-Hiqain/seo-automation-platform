import { useState, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Award,
  Blocks,
  CalendarClock,
  CheckCircle2,
  Compass,
  Download,
  ExternalLink,
  Flag,
  Frown,
  ImageIcon,
  Layers,
  Megaphone,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Dialog, buttonClass, ErrorState, Skeleton, Spinner, StatusBadge } from "../../../components/ui";
import { api } from "../../../lib/api";
import { forgetCompany } from "../../../lib/company";
import { usePipeline } from "../../../lib/pipeline";
import { errorMessage, useDeleteWebsite, useDisconnectWordPress, useProfile, useWordPressIntegration } from "../../../lib/queries";
import { clearRunLog } from "../../../lib/runLog";
import type { BusinessProfile } from "../../../lib/types";
import { formatDate, toText } from "../../../lib/utils";
import { useCompany } from "../CompanyLayout";
import { SettingsPanel, SoonBadge } from "./SettingsLayout";

const asList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(toText).filter(Boolean) : v ? [toText(v)].filter(Boolean) : [];

/** Loads the AI business profile, with shared loading / not-ready states. */
function useProfileState(websiteId: number) {
  const q = useProfile(websiteId);
  const fallback: ReactNode = q.isLoading ? (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  ) : q.error ? (
    <ErrorState error={q.error} onRetry={() => q.refetch()} />
  ) : null;
  return { profile: q.data?.profile ?? null, fallback };
}

function NotReady({ what }: { what: string }) {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-surface-2/70 px-4 py-3 text-sm text-ink-2">
      <Spinner className="size-4 text-brand-600" />
      {what} will appear here once our agents finish analyzing the website.
    </p>
  );
}

/* ------------------------------ Details ------------------------------ */

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="mb-1.5 text-sm font-medium text-ink">{label}</div>
      <div className="min-h-11 rounded-xl border border-line bg-surface-2/50 px-3.5 py-2.5 text-sm text-ink">{children}</div>
    </div>
  );
}

const Empty = () => <span className="text-ink-3">Not found on the website</span>;

export function DetailsSettings() {
  const company = useCompany();
  const pipeline = usePipeline(company.id);
  const { profile, fallback } = useProfileState(company.id);
  const site = company.website;
  const locations = asList(profile?.locations);

  return (
    <div className="space-y-6">
      <SettingsPanel title="Organization Details" description="Your organization's identity, as our agents understood it from your website.">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Organization name">{company.name}</Field>
        <Field label="Website">
          <span className="flex flex-wrap items-center gap-2">
            <a href={site.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 hover:text-brand-700">
              <span className="truncate">{site.url}</span>
              <ExternalLink className="size-3.5 shrink-0 text-ink-3" />
            </a>
            <StatusBadge status={site.status} />
          </span>
        </Field>

        {fallback ?? (
          <>
            <Field label="Industry">{profile?.industry ? toText(profile.industry) : <Empty />}</Field>
            <Field label="Setup">
              {pipeline.isComplete ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <CheckCircle2 className="size-4" /> Complete
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <Spinner className="size-3.5 text-brand-600" /> In progress ({pipeline.completed} of {pipeline.total})
                </span>
              )}
            </Field>
            <Field label="Locations">
              {locations.length ? (
                <span className="flex flex-wrap gap-1.5">
                  {locations.map((l) => (
                    <span key={l} className="rounded-md bg-surface px-2 py-0.5 ring-1 ring-line">
                      {l}
                    </span>
                  ))}
                </span>
              ) : (
                <Empty />
              )}
            </Field>
            <Field label="Added">{formatDate(site.created_at)}</Field>
            <Field label="About the business" wide>
              {profile?.business_summary ? (
                <span className="leading-relaxed text-ink-2">{toText(profile.business_summary)}</span>
              ) : profile ? (
                <Empty />
              ) : (
                <span className="text-ink-3">Being written by our agents…</span>
              )}
            </Field>
          </>
        )}
      </div>
      </SettingsPanel>
      <DeleteBusinessSection processing={pipeline.running} />
    </div>
  );
}

function DeleteBusinessSection({ processing }: { processing: boolean }) {
  const company = useCompany();
  const navigate = useNavigate();
  const remove = useDeleteWebsite(company.id);
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const confirmed = !processing && confirmation.trim() === company.website.url;

  const close = () => {
    if (remove.isPending) return;
    setOpen(false);
    setConfirmation("");
    remove.reset();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed || remove.isPending) return;
    try {
      await remove.mutateAsync(company.website.url);
      forgetCompany(company.id);
      clearRunLog(company.id);
      navigate("/", { replace: true });
    } catch {
      // The dialog displays the API error and stays open for another attempt.
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-rose-500/25 bg-surface p-5 sm:p-8">
        <h2 className="text-base font-semibold text-rose-700 dark:text-rose-400">Delete business</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Permanently remove this business and its data from Hiqain. Posts already published on WordPress will remain there.
        </p>
        {processing && <p className="mt-2 text-xs text-ink-3">Wait for the current setup task to finish before deleting.</p>}
        <Button variant="danger" size="sm" icon={Trash2} className="mt-4" onClick={() => setOpen(true)} disabled={processing}>
          Delete business
        </Button>
      </section>

      <Dialog
        open={open}
        onClose={close}
        title={`Delete ${company.name}?`}
        description="This permanently deletes its crawled pages, search data, profile, topics, keywords, articles, and saved WordPress connection from Hiqain. This cannot be undone."
      >
        <form onSubmit={submit}>
          <label htmlFor="confirm-business-url" className="block text-sm font-medium text-ink">
            Type <span className="break-all font-semibold">{company.website.url}</span> to confirm
          </label>
          <input
            id="confirm-business-url"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink"
          />
          <p className="mt-2 text-xs text-ink-3">Revoke Hiqain's Application Password in WordPress separately if you no longer need it.</p>
          {remove.error && <p role="alert" className="mt-3 text-sm text-rose-600">{errorMessage(remove.error)}</p>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={close} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" icon={Trash2} loading={remove.isPending} disabled={!confirmed}>
              Permanently delete
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/* ------------------------------ Brand ------------------------------ */

const BRAND_SECTIONS: { key: keyof BusinessProfile; title: string; icon: LucideIcon; chips?: boolean; wide?: boolean }[] = [
  { key: "services", title: "Services", icon: Wrench },
  { key: "service_categories", title: "Service categories", icon: Layers, chips: true },
  { key: "target_audience", title: "Target audience", icon: Users },
  { key: "customer_pain_points", title: "Customer pain points", icon: Frown },
  { key: "unique_selling_points", title: "Unique selling points", icon: Award },
  { key: "business_goals", title: "Business goals", icon: Flag },
  { key: "content_themes", title: "Content themes", icon: Compass, chips: true, wide: true },
  { key: "seo_opportunities", title: "SEO opportunities", icon: TrendingUp, wide: true },
];

export function BrandSettings() {
  const company = useCompany();
  const { profile, fallback } = useProfileState(company.id);

  return (
    <SettingsPanel title="Brand" description="The voice, audience and positioning our agents write for. Articles follow this profile.">
      {fallback ??
        (!profile ? (
          <NotReady what="Your brand profile" />
        ) : (
          <div className="space-y-5">
            <div className="flex gap-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-violet-500/10 text-violet-600">
                <Megaphone className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">Brand voice</div>
                <p className="mt-0.5 text-sm text-ink-2">{profile.brand_tone ? toText(profile.brand_tone) : "Not found on the website"}</p>
              </div>
            </div>

            <div className="grid items-start gap-4 md:grid-cols-2">
              {BRAND_SECTIONS.map(({ key, title, icon: Icon, chips, wide }) => {
                const items = asList(profile[key]);
                return (
                  <section key={key} className={wide ? "rounded-xl border border-line p-4 md:col-span-2" : "rounded-xl border border-line p-4"}>
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-4 text-brand-600" />
                      <h3 className="text-sm font-semibold text-ink">{title}</h3>
                      <span className="ml-auto text-xs text-ink-3 tabular-nums">{items.length || ""}</span>
                    </div>
                    {items.length === 0 ? (
                      <p className="mt-3 text-sm text-ink-3 italic">Not found on the website</p>
                    ) : chips ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {items.map((t, i) => (
                          <span key={i} className="rounded-lg bg-surface-2 px-2.5 py-1 text-sm text-ink-2">
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <ul className={wide ? "mt-3 grid gap-x-6 gap-y-2 md:grid-cols-2" : "mt-3 space-y-2"}>
                        {items.map((t, i) => (
                          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500/60" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        ))}
    </SettingsPanel>
  );
}

/* ------------------------------ Coming soon ------------------------------ */

function YetToCome({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-3">
        <Icon className="size-5" />
      </span>
      <Badge tone="neutral" className="mt-4">
        Yet to come
      </Badge>
      <p className="mt-3 max-w-sm text-sm text-ink-2">{text}</p>
    </div>
  );
}

export function AssetsSettings() {
  return (
    <SettingsPanel title="Assets" badge={<SoonBadge />} description="Logos, images and files your articles can use.">
      <YetToCome icon={ImageIcon} text="Uploading and managing brand assets is yet to come." />
    </SettingsPanel>
  );
}

export function IntegrationsSettings() {
  const company = useCompany();
  const integration = useWordPressIntegration(company.id);
  const disconnect = useDisconnectWordPress(company.id);
  const siteUrl = company.website.url.endsWith("/") ? company.website.url : `${company.website.url}/`;
  const uploadUrl = new URL("wp-admin/plugin-install.php?tab=upload", siteUrl).toString();
  const openWordPressAdmin = () => {
    window.open(uploadUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <SettingsPanel
      title="WordPress integration"
      badge={
        integration.data ? (
          <Badge tone="success" dot>
            Connected
          </Badge>
        ) : (
          <Badge tone="neutral">Not connected</Badge>
        )
      }
      description="Install the Hiqain plugin once, connect it in WordPress, then publish from the editor."
    >
      {integration.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : integration.error ? (
        <ErrorState error={integration.error} onRetry={() => integration.refetch()} />
      ) : integration.data ? (
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-ink">WordPress is ready</div>
              <p className="mt-0.5 text-sm text-ink-2">
                Article drafts can now be sent to this WordPress site from the article editor.
              </p>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-ink-3">Site</dt>
              <dd className="mt-1 text-sm font-medium text-ink">
                <a
                  href={integration.data.base_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-brand-700"
                >
                  {integration.data.base_url} <ExternalLink className="size-3.5" />
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-3">WordPress user</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{integration.data.username}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-3">Connected</dt>
              <dd className="mt-1 text-sm font-medium text-ink">{formatDate(integration.data.connected_at)}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className={buttonClass("secondary", "sm")}
          >
            {disconnect.isPending ? "Disconnecting…" : "Disconnect WordPress"}
          </button>
          {disconnect.error && <p role="alert" className="text-sm text-red-600">{errorMessage(disconnect.error)}</p>}
          <p className="text-xs text-ink-3">Disconnecting removes the saved credential here. Revoke it in WordPress too if you no longer need it.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-ink-3">
            <Blocks className="size-5" />
          </span>
          <h3 className="mt-4 text-sm font-semibold text-ink">Connect {company.website.url}</h3>
          <ol className="mt-3 max-w-2xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-ink-2">
            <li>Download the Hiqain plugin ZIP. A new tab will open the WordPress plugin upload page.</li>
            <li>Log in on your WordPress site, choose the downloaded ZIP, click Install Now, then Activate.</li>
            <li>In WordPress, open the Hiqain menu and click Connect. This page will update when the connection completes.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={api.wordPressPluginDownloadUrl()}
              download="hiqain-wordpress-plugin.zip"
              onClick={openWordPressAdmin}
              className={buttonClass("primary", "md")}
            >
              <Download className="size-4" /> Download plugin and open WordPress
            </a>
            <a href={uploadUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "md")}>
              Open WordPress upload <ExternalLink className="size-4" />
            </a>
          </div>
          <div className="mt-4 max-w-2xl rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs leading-relaxed text-ink-2">
            <p className="font-semibold text-ink">Hosted WordPress sites need one server setting</p>
            <p className="mt-1">
              Before clicking Connect in WordPress, ask your site administrator to set <code>SEOA_API_BASE</code> to the public HTTPS FastAPI URL and <code>SEOA_APP_URL</code> to this dashboard URL in <code>wp-config.php</code>. The supplied ZIP otherwise points to localhost. Exact examples are in WORDPRESS-SETUP.md.
            </p>
          </div>
        </div>
      )}
    </SettingsPanel>
  );
}

export function ScheduleSettings() {
  return (
    <SettingsPanel title="Schedule" badge={<SoonBadge />} description="Choose when new articles are written and published.">
      <YetToCome icon={CalendarClock} text="Scheduling is yet to come." />
    </SettingsPanel>
  );
}
