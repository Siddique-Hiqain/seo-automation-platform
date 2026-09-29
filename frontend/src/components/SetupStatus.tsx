import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Sparkles } from "lucide-react";
import { Button, Card, Spinner } from "./ui";
import { useAgentRunReason, useAgents } from "../lib/queries";
import { stepLabel, usePipeline } from "../lib/pipeline";

/** Businesses whose setup was auto-started this session (prevents re-triggering loops). */
const autoStarted = new Set<number>();

/**
 * Runs the backend agents for a business that isn't fully set up yet: right after
 * it's added, or when the user comes back to one whose setup was interrupted
 * (e.g. the tab was closed). Shows progress while they work; the user never runs
 * steps by hand. If an agent fails, setup pauses and offers a retry.
 */
export function SetupStatus({ websiteId, name }: { websiteId: number; name: string }) {
  const p = usePipeline(websiteId);
  const agents = useAgents(websiteId);
  const reason = useAgentRunReason(websiteId);

  useEffect(() => {
    if (p.loading || p.running || p.isComplete || p.failed || autoStarted.has(websiteId)) return;
    autoStarted.add(websiteId);
    agents.mutate({ steps: p.remaining, reason: "setup" });
  }, [p.loading, p.running, p.isComplete, p.failed, p.remaining, websiteId, agents]);

  // Nothing to show once set up, or while "More topics" runs (Topic Research shows that).
  if (p.loading || p.isComplete || reason === "more-topics") return null;

  if (p.failed) {
    return (
      <Card className="flex flex-col gap-4 border-rose-500/25 bg-rose-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Setup paused while {stepLabel(p.failed.step).toLowerCase()}</p>
            <p className="mt-0.5 text-sm wrap-break-word text-ink-2">{p.failed.message}</p>
          </div>
        </div>
        <Button icon={RotateCcw} onClick={() => agents.mutate({ steps: p.remaining, reason: "setup" })} className="shrink-0">
          Retry setup
        </Button>
      </Card>
    );
  }

  const step = p.currentStep ?? p.remaining[0];
  const current = Math.min(p.completed + 1, p.total);

  return (
    <Card className="relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-brand-500/10 blur-3xl" />
      <div className="relative flex items-start gap-4">
        <span className="relative grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-violet-500 text-white shadow-sm shadow-brand-600/30">
          <Sparkles className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-ink">Setting up {name}</p>
            <span className="text-xs font-medium text-ink-3 tabular-nums">
              Step {current} of {p.total}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
            <Spinner className="size-3.5 text-brand-600" />
            {step ? `${stepLabel(step)}…` : "Starting…"}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-linear-to-r from-brand-500 to-violet-500 transition-[width] duration-700"
              style={{ width: `${Math.max(4, (p.completed / p.total) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Our agents are working through this automatically. It usually takes a few minutes, and you can keep using the app.
          </p>
        </div>
      </div>
    </Card>
  );
}
