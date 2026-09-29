import { useEffect, type ReactNode } from "react";
import { Outlet, useOutletContext, useParams } from "react-router-dom";
import { ErrorState, Skeleton } from "../../components/ui";
import { CompanyAvatar } from "../../components/CompanySwitcher";
import { SetupStatus } from "../../components/SetupStatus";
import { NotFoundPage } from "../NotFoundPage";
import { rememberCompany, useCompanies, type Company } from "../../lib/company";

/** Wraps every /c/:websiteId/* page: validates the company and remembers it as selected. */
export function CompanyLayout() {
  const id = Number(useParams().websiteId);
  const { companies, isLoading, error, refetch } = useCompanies();
  const company = companies.find((c) => c.id === id);

  useEffect(() => {
    if (company) rememberCompany(company.id);
  }, [company]);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  if (!company)
    return <NotFoundPage title="Business not found" description="This business doesn't exist or was removed. Pick another one from the menu." />;

  return (
    <div className="space-y-6">
      <SetupStatus websiteId={company.id} name={company.name} />
      <Outlet context={company} />
    </div>
  );
}

export const useCompany = () => useOutletContext<Company>();

export function PageHeader({
  title,
  description,
  company,
  actions,
}: {
  title: string;
  description?: ReactNode;
  company: Company;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-ink-3">
          <CompanyAvatar company={company} className="size-5 rounded text-[10px]" />
          <span className="truncate">{company.name}</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
