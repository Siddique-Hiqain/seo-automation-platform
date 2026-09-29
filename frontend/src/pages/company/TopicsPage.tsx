import { TopicsTab } from "../../components/website/TopicsTab";
import { PageHeader, useCompany } from "./CompanyLayout";

export function TopicsPage() {
  const company = useCompany();
  return (
    <div className="space-y-6">
      <PageHeader
        company={company}
        title="Topic Research"
        description="Content opportunities for this business, ranked by search demand and business value."
      />
      <TopicsTab websiteId={company.id} />
    </div>
  );
}
