import { useSyncExternalStore } from "react";

/**
 * The backend doesn't persist when chunking/embedding/keyword research ran,
 * so we remember the last result of each pipeline step per website locally.
 * This is a convenience only — the UI also infers progress from server data.
 */

export type StepKey = "crawl" | "chunk" | "embed" | "profile" | "topics" | "keywords" | "score";

export interface RunRecord {
  at: number;
  ok: boolean;
  summary: string;
}

type Log = Record<number, Partial<Record<StepKey, RunRecord>>>;

const STORAGE_KEY = "seo.runlog.v1";
const listeners = new Set<() => void>();

function read(): Log {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Log;
  } catch {
    return {};
  }
}

let cache: Log = read();

export function recordRun(websiteId: number, step: StepKey, record: Omit<RunRecord, "at">) {
  cache = { ...cache, [websiteId]: { ...cache[websiteId], [step]: { ...record, at: Date.now() } } };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — keep in memory */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useRunLog(websiteId: number) {
  const log = useSyncExternalStore(subscribe, () => cache);
  return log[websiteId] ?? {};
}

/* ----- Which step the autopilot is currently running (in-memory only) ----- */

let autopilot: Record<number, StepKey | null> = {};

export function clearRunLog(websiteId: number) {
  const nextLog = { ...cache };
  delete nextLog[websiteId];
  cache = nextLog;
  const nextSteps = { ...autopilot };
  delete nextSteps[websiteId];
  autopilot = nextSteps;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — keep in memory */
  }
  listeners.forEach((l) => l());
}

export function setAutopilotStep(websiteId: number, step: StepKey | null) {
  autopilot = { ...autopilot, [websiteId]: step };
  listeners.forEach((l) => l());
}

export function useAutopilotStep(websiteId: number): StepKey | null {
  return useSyncExternalStore(subscribe, () => autopilot)[websiteId] ?? null;
}

export function useAutopilotSteps(): Record<number, StepKey | null> {
  return useSyncExternalStore(subscribe, () => autopilot);
}
