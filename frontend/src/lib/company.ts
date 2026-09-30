import { useSyncExternalStore } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchProfile, keys, useWebsites } from "./queries";
import type { Website } from "./types";
import { hostname } from "./utils";

/**
 * A "company" is a website from the backend, named after the business name
 * in its AI profile when one exists, otherwise its domain.
 */
export interface Company {
  id: number;
  name: string;
  domain: string;
  website: Website;
}

export function useCompanies() {
  const websites = useWebsites();
  const list = websites.data ?? [];
  const profiles = useQueries({
    queries: list.map((w) => ({ queryKey: keys.profile(w.id), queryFn: () => fetchProfile(w.id) })),
  });
  const companies: Company[] = list.map((w, i) => {
    const name = profiles[i]?.data?.profile.business_name;
    return {
      id: w.id,
      name: typeof name === "string" && name.trim() ? name.trim() : hostname(w.url),
      domain: hostname(w.url),
      website: w,
    };
  });
  return { ...websites, companies };
}

/* ------------- Last selected company, remembered across visits ------------- */

const KEY = "seo.selectedCompany";
const listeners = new Set<() => void>();

function read(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

let selected = read();

export function rememberCompany(id: number) {
  if (selected === id) return;
  selected = id;
  try {
    localStorage.setItem(KEY, String(id));
  } catch {
    /* storage unavailable — keep in memory */
  }
  listeners.forEach((l) => l());
}

export function forgetCompany(id: number) {
  if (selected !== id) return;
  selected = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — keep in memory */
  }
  listeners.forEach((l) => l());
}

export function useRememberedCompany() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => selected,
  );
}

/** Stable colour for a company's letter avatar. */
const AVATAR_COLORS = [
  "bg-slate-700",
  "bg-brand-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
];
export const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

/** URL helpers for company-scoped pages. */
export const companyPath = {
  articles: (id: number) => `/c/${id}/articles`,
  article: (id: number, articleId: number) => `/c/${id}/articles/${articleId}`,
  topics: (id: number) => `/c/${id}/topics`,
  settings: (id: number) => `/c/${id}/settings`,
};
