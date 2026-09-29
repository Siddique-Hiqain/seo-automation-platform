import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Loader2, X } from "lucide-react";
import { cn, faviconUrl } from "../lib/utils";

/* ------------------------------ Button ------------------------------ */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-600/60",
  secondary:
    "bg-surface text-ink border border-line-strong shadow-xs hover:bg-surface-2 hover:border-ink-3/40",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
  subtle: "bg-brand-500/10 text-brand-700 hover:bg-brand-500/15 dark:text-brand-300",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-11 px-5 text-sm gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ComponentType<{ className?: string }>;
}

export const buttonClass = (variant: Variant = "primary", size: Size = "md", className?: string) =>
  cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center font-medium whitespace-nowrap transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );

export function ButtonLink({
  to,
  variant = "primary",
  size = "md",
  icon: Icon,
  className,
  children,
}: {
  to: string;
  variant?: Variant;
  size?: Size;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, className)}>
      {Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} />}
      {children}
    </Link>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon: Icon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading ? (
        <Loader2 className={cn("animate-spin", size === "sm" ? "size-3.5" : "size-4")} />
      ) : (
        Icon && <Icon className={size === "sm" ? "size-3.5" : "size-4"} />
      )}
      {children}
    </button>
  );
});

/* ------------------------------ Badge ------------------------------ */

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "violet";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2 ring-line-strong",
  brand: "bg-brand-500/10 text-brand-700 ring-brand-500/20 dark:text-brand-300",
  success: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-400",
  danger: "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-400",
  info: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400",
  violet: "bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300",
};

export function Badge({
  tone = "neutral",
  dot,
  pulse,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex size-1.5">
          {pulse && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />}
          <span className="relative inline-flex size-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}

export const websiteStatusTone = (status: string): Tone =>
  status === "crawled" ? "success" : status === "crawling" ? "info" : status === "failed" ? "danger" : "neutral";

export function StatusBadge({ status }: { status: string }) {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <Badge tone={websiteStatusTone(status)} dot pulse={status === "crawling"}>
      {label}
    </Badge>
  );
}

/* ------------------------------ Layout bits ------------------------------ */

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} />;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="relative mb-4">
        <div className="absolute inset-0 scale-150 rounded-full bg-brand-500/10 blur-xl" />
        <div className="relative grid size-12 place-items-center rounded-2xl border border-line bg-surface shadow-sm">
          <Icon className="size-5 text-brand-600 dark:text-brand-400" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Couldn't load data</p>
        <p className="mt-0.5 text-sm text-ink-2">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ------------------------------ Dialog ------------------------------ */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = panelRef.current?.querySelector<HTMLElement>("input, textarea, select");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full animate-slide-up rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-6">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mt-1 -mr-2 grid size-8 cursor-pointer place-items-center rounded-lg text-ink-3 transition hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        {children && <div className="px-6 py-5">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/50 px-6 py-4 sm:flex-row sm:justify-end sm:rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------ Tabs ------------------------------ */

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="flex min-w-max gap-1 border-b border-line">
        {items.map(({ value: v, label, icon: Icon, count }) => {
          const active = v === value;
          return (
            <button
              key={v}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(v)}
              className={cn(
                "relative flex cursor-pointer items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors",
                active ? "text-ink" : "text-ink-3 hover:text-ink-2",
              )}
            >
              {Icon && <Icon className={cn("size-4", active && "text-brand-600 dark:text-brand-400")} />}
              {label}
              {count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                    active ? "bg-brand-500/10 text-brand-700 dark:text-brand-300" : "bg-surface-2 text-ink-3",
                  )}
                >
                  {count}
                </span>
              )}
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------ Misc ------------------------------ */

export function ProgressRing({ value, size = 44, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
        className="stroke-brand-600 transition-[stroke-dashoffset] duration-700 dark:stroke-brand-400"
      />
    </svg>
  );
}

export function Favicon({ url, className }: { url: string; className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white", className)}>
      <img
        src={faviconUrl(url)}
        alt=""
        className="size-[60%]"
        loading="lazy"
        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
      />
    </span>
  );
}

