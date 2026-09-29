import { createBrowserRouter, Navigate, RouterProvider, useSearchParams } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { HomePage, LegacyWebsiteRedirect } from "./pages/HomePage";
import { CompanyLayout } from "./pages/company/CompanyLayout";
import { ArticlesPage } from "./pages/company/ArticlesPage";
import { TopicsPage } from "./pages/company/TopicsPage";
import { SettingsLayout } from "./pages/company/settings/SettingsLayout";
import {
  AssetsSettings,
  BrandSettings,
  DetailsSettings,
  IntegrationsSettings,
  ScheduleSettings,
} from "./pages/company/settings/sections";
import { NotFoundPage } from "./pages/NotFoundPage";
import { Spinner } from "./components/ui";

const articleEditor = async () => ({ Component: (await import("./pages/ArticlePage")).ArticlePage });

// A data router is required for useBlocker (unsaved-changes guard in the editor).
// The article editor (Markdown rendering) is code-split.
const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <PageLoader />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "dashboard", element: <WordPressDashboardRedirect /> },
      {
        // Everything for one business ("company") lives under /c/:websiteId
        path: "c/:websiteId",
        element: <CompanyLayout />,
        children: [
          { index: true, element: <Navigate to="articles" replace /> },
          { path: "articles", element: <ArticlesPage /> },
          { path: "articles/:articleId", lazy: articleEditor },
          { path: "topics", element: <TopicsPage /> },
          {
            path: "settings",
            element: <SettingsLayout />,
            children: [
              { index: true, element: <Navigate to="details" replace /> },
              { path: "details", element: <DetailsSettings /> },
              { path: "assets", element: <AssetsSettings /> },
              { path: "brand", element: <BrandSettings /> },
              { path: "integrations", element: <IntegrationsSettings /> },
              { path: "schedule", element: <ScheduleSettings /> },
            ],
          },
        ],
      },
      // Old URLs
      { path: "websites", element: <Navigate to="/" replace /> },
      { path: "websites/:websiteId", element: <LegacyWebsiteRedirect /> },
      { path: "articles/:articleId", lazy: articleEditor },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

function WordPressDashboardRedirect() {
  const [searchParams] = useSearchParams();
  const websiteId = Number(searchParams.get("website_id"));
  return Number.isInteger(websiteId) && websiteId > 0 ? (
    <Navigate to={`/c/${websiteId}/settings/integrations`} replace />
  ) : (
    <Navigate to="/" replace />
  );
}

function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center text-ink-3">
      <Spinner className="size-6" />
    </div>
  );
}

export function App() {
  return <RouterProvider router={router} />;
}
