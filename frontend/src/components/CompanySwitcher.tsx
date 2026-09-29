import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { Skeleton, Spinner } from "./ui";
import { avatarColor, companyPath, useCompanies, type Company } from "../lib/company";
import { cn } from "../lib/utils";

export function CompanyAvatar({ company, className }: { company: Pick<Company, "id" | "name">; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white uppercase",
        avatarColor(company.id),
        className,
      )}
    >
      {company.name.trim()[0] ?? "?"}
    </span>
  );
}

/** Where to go when switching company: stay in the same section. */
function sectionOf(pathname: string): "articles" | "topics" | "settings" {
  if (/^\/c\/\d+\/topics/.test(pathname)) return "topics";
  if (/^\/c\/\d+\/settings/.test(pathname)) return "settings";
  return "articles";
}

export function CompanySwitcher({ currentId, onAdd }: { currentId: number | null; onAdd: () => void }) {
  const { companies, isLoading } = useCompanies();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const current = companies.find((c) => c.id === currentId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return companies.filter((c) => !q || c.name.toLowerCase().includes(q) || c.domain.includes(q));
  }, [companies, query]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const select = (c: Company) => {
    setOpen(false);
    setQuery("");
    if (c.id === currentId) return;
    const section = sectionOf(pathname);
    navigate(companyPath[section](c.id));
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-surface-2/70 p-2.5 text-left transition hover:bg-surface-2",
          open && "border-line bg-surface-2",
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="size-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </>
        ) : current ? (
          <>
            <CompanyAvatar company={current} />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold text-ink">{current.name}</div>
              <div className="truncate text-xs text-ink-3">{current.domain}</div>
            </div>
          </>
        ) : (
          <>
            <img src="/favicon.svg" alt="" className="size-9 rounded-lg" />
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold text-ink">Select a business</div>
              <div className="truncate text-xs text-ink-3">
                {companies.length} business{companies.length === 1 ? "" : "es"}
              </div>
            </div>
          </>
        )}
        <ChevronsUpDown className="size-4 shrink-0 text-ink-3" />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-50 mt-1.5 animate-slide-up overflow-hidden rounded-xl border border-line bg-surface shadow-xl shadow-slate-950/10">
          <div className="p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-3" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && filtered[0] && select(filtered[0])}
                placeholder="Search businesses"
                aria-label="Search businesses"
                className="h-9 w-full rounded-lg border border-line-strong bg-surface pr-3 pl-8 text-sm text-ink outline-none placeholder:text-ink-3 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15"
              />
            </div>
          </div>

          <ul role="listbox" aria-label="Businesses" className="scrollbar-thin max-h-64 overflow-y-auto px-1.5 pb-1.5">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-ink-3">
                {companies.length ? "No matching businesses" : "No businesses yet"}
              </li>
            ) : (
              filtered.map((c) => {
                const active = c.id === currentId;
                return (
                  <li key={c.id}>
                    <button
                      role="option"
                      aria-selected={active}
                      onClick={() => select(c)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left transition hover:bg-surface-2",
                        active && "bg-surface-2/70",
                      )}
                    >
                      <CompanyAvatar company={c} className="size-7 rounded-md text-xs" />
                      <div className="min-w-0 flex-1 leading-tight">
                        <div className="truncate text-sm font-medium text-ink">{c.name}</div>
                        {c.name !== c.domain && <div className="truncate text-[11px] text-ink-3">{c.domain}</div>}
                      </div>
                      {c.website.status === "crawling" && <Spinner className="size-3.5 text-sky-500" />}
                      <span
                        className={cn(
                          "grid size-4.5 shrink-0 place-items-center rounded-full border transition",
                          active ? "border-brand-600 bg-brand-600 text-white" : "border-line-strong",
                        )}
                      >
                        {active && <Check className="size-3" strokeWidth={3} />}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-line p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onAdd();
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              <Plus className="size-4" />
              Add business
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
