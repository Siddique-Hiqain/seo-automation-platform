import { useState, type FormEvent, type ReactNode } from "react";
import {
  Award,
  Blocks,
  CalendarClock,
  CheckCircle2,
  Compass,
  ExternalLink,
  Flag,
  Frown,
  ImageIcon,
  Layers,
  Megaphone,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Badge, buttonClass, ErrorState, Skeleton, Spinner, StatusBadge } from "../../../components/ui";
import { usePipeline } from "../../../lib/pipeline";
import { errorMessage, useConnectWordPress, useDisconnectWordPress, useProfile, useWordPressIntegration } from "../../../lib/queries";
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
  const connect = useConnectWordPress(company.id);
  const disconnect = useDisconnectWordPress(company.id);
  const [username, setUsername] = useState("");
  const [applicationPassword, setApplicationPassword] = useState("");

  const submitConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await connect.mutateAsync({ username: username.trim(), application_password: applicationPassword });
      setApplicationPassword("");
    } catch {
      // The mutation error is shown next to the form.
    }
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
      description="Connect with a WordPress Application Password once, then publish from the editor."
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
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
            In WordPress, open Users → Profile → Application Passwords. Create one named “Hiqain” and paste it below with your WordPress username. Do not enter your normal login password.
          </p>
          <form className="mt-5 max-w-lg space-y-4" onSubmit={submitConnection}>
            <label className="block text-sm font-medium text-ink">
              WordPress username
              <input
                type="text"
                autoComplete="username"
                required
                maxLength={255}
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink"
              />
            </label>
            <label className="block text-sm font-medium text-ink">
              Application Password
              <input
                type="password"
                autoComplete="new-password"
                required
                maxLength={255}
                value={applicationPassword}
                onChange={(event) => setApplicationPassword(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink"
              />
            </label>
            {connect.error && <p role="alert" className="text-sm text-red-600">{errorMessage(connect.error)}</p>}
            <button type="submit" disabled={connect.isPending} className={buttonClass("primary", "md")}>
              {connect.isPending ? "Verifying…" : "Connect WordPress"}
            </button>
          </form>
          <p className="mt-4 text-xs text-ink-3">The account needs permission to edit and publish posts. WordPress must be reachable from this server over HTTPS in production.</p>
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
