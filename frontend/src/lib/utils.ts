import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names; later Tailwind classes override conflicting earlier ones. */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const APP_NAME = "RankPilot";

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function pathOf(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search || "/";
  } catch {
    return url;
  }
}

/** Backend returns naive datetimes (MySQL DATETIME) — parse them as-is. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | null | undefined, withTime = false): string {
  const d = parseDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

export function timeAgo(value: string | number | null | undefined): string {
  const d = typeof value === "number" ? new Date(value) : parseDate(value ?? null);
  if (!d) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2629800, "month"],
    [31557600, "year"],
  ];
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  let div = 60;
  for (const [secs, u] of units) {
    if (s >= secs) {
      unit = u;
      div = secs;
    }
  }
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(-Math.round(s / div), unit);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { notation: n >= 10000 ? "compact" : "standard" }).format(n);
}

/** Strips HTML tags and Markdown symbols so counts reflect readable text. */
export function plainText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[#*_>`~|]/g, " ");
}

/** LLM articles may be HTML or Markdown. */
export const isHtml = (text: string) => /<\/?(p|h[1-6]|ul|ol|li|div|strong|table)[\s>]/i.test(text);

/** True when the content already opens with its own H1 (so we shouldn't render the title again). */
export const startsWithH1 = (text: string) => /^\s*(<h1[\s>]|#\s)/i.test(text);

export function wordCount(text: string): number {
  const t = plainText(text).trim();
  return t ? t.split(/\s+/).length : 0;
}

export function readingTime(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 225));
}

/** Converts unknown LLM output (string, object, number) into display text. */
export function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const primary = o.name ?? o.title ?? o.label ?? o.service ?? o.value;
    const secondary = o.description ?? o.details ?? o.summary;
    if (primary && secondary) return `${toText(primary)} — ${toText(secondary)}`;
    if (primary) return toText(primary);
    return Object.values(o).map(toText).filter(Boolean).join(" — ");
  }
  return String(value);
}

export function normalizeUrl(input: string): string {
  const v = input.trim();
  if (!v) return v;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

export function faviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname(url))}&sz=64`;
}
