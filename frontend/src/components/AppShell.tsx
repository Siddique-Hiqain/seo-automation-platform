import { createContext, useContext, useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatch } from "react-router-dom";
import { useMutationState } from "@tanstack/react-query";
import { FileText, Lightbulb, Menu, Settings, type LucideIcon } from "lucide-react";
import { AddWebsiteDialog } from "./AddWebsiteDialog";
import { CompanyAvatar, CompanySwitcher } from "./CompanySwitcher";
import { Spinner } from "./ui";
import { companyPath, useCompanies, useRememberedCompany } from "../lib/company";
import { stepLabel } from "../lib/pipeline";
import { useAutopilotSteps } from "../lib/runLog";
import { APP_NAME, cn } from "../lib/utils";

/* ---------------- Add-business dialog is reachable from anywhere ---------------- */

const AddWebsiteContext = createContext<() => void>(() => {});
export const useAddWebsite = () => useContext(AddWebsiteContext);

/** The company in the URL, falling back to the last one the user picked. */
function useCurrentCompanyId() {
  const match = useMatch({ path: "/c/:websiteId", end: false });
  const remembered = useRememberedCompany();
  const fromUrl = Number(match?.params.websiteId);
  return Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : remembered;
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const location = useLocation();
  const currentId = useCurrentCompanyId();

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const sidebar = <Sidebar currentId={currentId} onAdd={() => setAddOpen(true)} />;

  return (
    <AddWebsiteContext.Provider value={() => setAddOpen(true)}>
      <div className="flex min-h-full">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-line bg-surface lg:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="relative h-full w-72 max-w-[85vw] animate-slide-up border-r border-line bg-surface shadow-2xl">
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopbar currentId={currentId} onMenu={() => setMobileOpen(true)} />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
      <AddWebsiteDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </AddWebsiteContext.Provider>
  );
}

/* ------------------------------ Sidebar ------------------------------ */

function NavItem({ to, icon: Icon, label, disabled }: { to: string; icon: LucideIcon; label: string; disabled?: boolean }) {
  if (disabled) {
    return (
      <span className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-3/60">
        <Icon className="size-4.5" />
        {label}
      </span>
    );
  }
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
          isActive ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-brand-600" />}
          <Icon className="size-4.5" />
          {label}
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ currentId, onAdd }: { currentId: number | null; onAdd: () => void }) {
  const id = currentId ?? 0;
  const hasCompany = currentId != null;

  return (
    <div className="flex h-full flex-col">
      <div className="p-3 pt-4">
        <CompanySwitcher currentId={currentId} onAdd={onAdd} />
      </div>

      <nav className="mt-3 space-y-1 px-3" aria-label="Main">
        <NavItem to={companyPath.articles(id)} icon={FileText} label="Articles" disabled={!hasCompany} />
        <NavItem to={companyPath.topics(id)} icon={Lightbulb} label="Topic Research" disabled={!hasCompany} />
        <NavItem to={companyPath.settings(id)} icon={Settings} label="Settings" disabled={!hasCompany} />
      </nav>

      <div className="mt-auto p-3">
        <RunningTasks />
      </div>
    </div>
  );
}

/* ------------------------------ Mobile top bar ------------------------------ */

function MobileTopbar({ currentId, onMenu }: { currentId: number | null; onMenu: () => void }) {
  const { companies } = useCompanies();
  const current = companies.find((c) => c.id === currentId);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl lg:hidden">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <button
          onClick={onMenu}
          className="grid size-9 cursor-pointer place-items-center rounded-lg text-ink-2 hover:bg-surface-2"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        {current ? (
          <button onClick={onMenu} className="flex min-w-0 cursor-pointer items-center gap-2.5">
            <CompanyAvatar company={current} className="size-7 rounded-md text-xs" />
            <span className="truncate text-sm font-semibold text-ink">{current.name}</span>
          </button>
        ) : (
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-ink">
            <img src="/favicon.svg" alt="" className="size-7 rounded-md" />
            {APP_NAME}
          </Link>
        )}
      </div>
    </header>
  );
}

/* ------------------------------ Running tasks ------------------------------ */

/** Long-running AI jobs, so users know work continues while they browse. */
function RunningTasks() {
  const pending = useMutationState({
    filters: { status: "pending" },
    select: (m) => m.options.mutationKey,
  }).filter((k): k is readonly unknown[] => Array.isArray(k) && (k[0] === "agents" || k[0] === "write"));
  const { companies } = useCompanies();
  const currentSteps = useAutopilotSteps();

  if (pending.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-2">
      <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-1.5 text-xs font-semibold text-brand-700 dark:text-brand-300">
        <Spinner className="size-3.5" />
        {pending.length} task{pending.length > 1 ? "s" : ""} running
      </div>
      <ul className="space-y-0.5">
        {pending.map((k, i) => {
          if (k[0] === "write")
            return (
              <li key={i} className="px-1.5 py-1 text-xs text-ink-2">
                Writing article
              </li>
            );
          const company = companies.find((c) => c.id === k[1]);
          const step = currentSteps[k[1] as number];
          return (
            <li key={i}>
              <Link
                to={companyPath.topics(k[1] as number)}
                className="block rounded-lg px-1.5 py-1 text-xs text-ink-2 transition hover:bg-surface hover:text-ink"
              >
                {step ? stepLabel(step) : "Working"}
                {company && <span className="text-ink-3"> · {company.name}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-1.5 pt-1.5 text-[11px] text-ink-3">You can keep working meanwhile.</p>
    </div>
  );
}
