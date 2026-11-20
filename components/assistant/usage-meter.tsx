"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const TICKS = 40;

/**
 * The workspace's assistant requests used today, as a row of hairline ticks
 * and a count. Near the limit the used ticks and the count turn destructive.
 */
export function UsageMeter({ className = "" }: { className?: string }) {
  const usage = useQuery(api.ai.guard.usage, {});
  if (usage === undefined || usage.limit === 0) return null;
  const share = Math.min(1, usage.used / usage.limit);
  const near = share >= 0.9;
  const filled = Math.round(share * TICKS);
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="meter"
        aria-label="Assistant requests used today"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        className={`flex h-2.5 flex-1 justify-between ${near ? "text-destructive" : "text-foreground"}`}
      >
        {Array.from({ length: TICKS }, (_, index) => (
          <span key={index} className={`w-px ${index < filled ? "bg-current" : "bg-rule"}`} />
        ))}
      </div>
      <span className={`data shrink-0 text-[11px] uppercase ${near ? "text-destructive" : "text-muted-foreground"}`}>
        {usage.used}/{usage.limit} today
      </span>
    </div>
  );
}

/** True once the workspace has used today's allowance. */
export function useAllowanceSpent(): boolean {
  const usage = useQuery(api.ai.guard.usage, {});
  return usage !== undefined && usage.limit > 0 && usage.used >= usage.limit;
}
