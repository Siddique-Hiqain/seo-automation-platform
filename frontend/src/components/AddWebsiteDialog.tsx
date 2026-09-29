import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Globe, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button, Dialog } from "./ui";
import { useCreateWebsite, errorMessage } from "../lib/queries";
import { isValidUrl, normalizeUrl, hostname } from "../lib/utils";

export function AddWebsiteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const create = useCreateWebsite();
  const navigate = useNavigate();

  const close = () => {
    if (create.isPending) return;
    setValue("");
    setError(null);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const url = normalizeUrl(value);
    if (!isValidUrl(url)) {
      setError("Enter a valid website address, e.g. example.com");
      return;
    }
    setError(null);
    create.mutate(url, {
      onSuccess: (site) => {
        toast.success(`${hostname(site.url)} added`);
        setValue("");
        onClose();
        navigate(`/c/${site.id}/topics`);
      },
      onError: (err) => setError(errorMessage(err)),
    });
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a business"
      description="Enter the business website. Our agents will crawl it, learn what the business does, and research and score SEO topics automatically."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="site-url" className="label">
          Website URL
        </label>
        <div className="relative">
          <Globe className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <input
            id="site-url"
            className="input pl-10"
            placeholder="example.com"
            inputMode="url"
            autoComplete="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={!!error}
            aria-describedby="site-url-help"
          />
        </div>
        <p
          id="site-url-help"
          className={error ? "mt-2 text-sm text-rose-600 dark:text-rose-400" : "mt-2 text-xs text-ink-3"}
        >
          {error ?? "https:// is added automatically if you leave it out."}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={close} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" icon={Plus} loading={create.isPending}>
            Add business
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
