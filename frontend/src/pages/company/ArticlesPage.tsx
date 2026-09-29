import { useNavigate } from "react-router-dom";
import { ArticlesTab } from "../../components/website/ArticlesTab";
import { companyPath } from "../../lib/company";
import { PageHeader, useCompany } from "./CompanyLayout";

export function ArticlesPage() {
  const company = useCompany();
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <PageHeader
        company={company}
        title="Articles"
        description="SEO articles drafted from your topics. Open one to edit, check its SEO score and export it."
      />
      <ArticlesTab websiteId={company.id} onNavigate={() => navigate(companyPath.topics(company.id))} />
    </div>
  );
}
