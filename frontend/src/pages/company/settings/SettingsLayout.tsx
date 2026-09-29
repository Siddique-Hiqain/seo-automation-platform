import type { ReactNode } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Blocks, Building2, CalendarClock, ImageIcon, Sparkles, type LucideIcon } from "lucide-react";
import { Badge, Card } from "../../../components/ui";
import { cn } from "../../../lib/utils";
import { PageHeader, useCompany } from "../CompanyLayout";

const SECTIONS: { to: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { to: "details", label: "Details", icon: Building2 },
  { to: "assets", label: "Assets", icon: ImageIcon, soon: true },
  { to: "brand", label: "Brand", icon: Sparkles },
  { to: "integrations", label: "Integrations", icon: Blocks },
  { to: "schedule", label: "Schedule", icon: CalendarClock, soon: true },
];

export function SettingsLayout() {
  const company = useCompany();

  return (
    <div className="space-y-6">
      <PageHeader company={company} title="Settings" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <Card className="p-3 lg:sticky lg:top-8">
          <div className="hidden px-3 pt-2 pb-2 text-xs font-semibold text-ink lg:block">Organization</div>
          <nav aria-label="Settings" className="scrollbar-thin -m-1 flex gap-1 overflow-x-auto p-1 lg:m-0 lg:flex-col lg:overflow-visible lg:p-0">
            {SECTIONS.map(({ to, label, icon: Icon, soon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                    isActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute inset-x-2 -bottom-1 h-0.5 rounded-full bg-brand-600 lg:inset-x-auto lg:top-1.5 lg:bottom-1.5 lg:-left-0.5 lg:h-auto lg:w-1" />
                    )}
                    <Icon className="size-4" />
                    {label}
                    {soon && <span className="ml-auto hidden text-[10px] font-medium text-ink-3 lg:inline">Soon</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </Card>

        <div className="min-w-0">
          <Outlet context={company} />
        </div>
      </div>
    </div>
  );
}

/** The white panel each settings section renders into. */
export function SettingsPanel({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: ReactNode;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {badge}
      </div>
      <p className="mt-1 text-sm text-ink-2">{description}</p>
      <div className="mt-7">{children}</div>
    </Card>
  );
}

export function SoonBadge() {
  return <Badge tone="neutral">Yet to come</Badge>;
}
