import { Compass } from "lucide-react";
import { ButtonLink, EmptyState } from "../components/ui";

export function NotFoundPage({ title = "Page not found", description }: { title?: string; description?: string }) {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title={title}
        description={description ?? "The page you're looking for doesn't exist or has been moved."}
        action={
          <ButtonLink to="/" variant="secondary">
            Back to dashboard
          </ButtonLink>
        }
      />
    </div>
  );
}
