"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/** The workspace's assistant requests used today, as a thin bar and a count. */
export function UsageMeter({ className = "" }: { className?: string }) {
  const usage = useQuery(api.ai.guard.usage, {});
  if (usage === undefined || usage.limit === 0) return null;
  const share = Math.min(1, usage.used / usage.limit);
  const near = share >= 0.9;
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="meter"
        aria-label="Assistant requests used today"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${share * 100}%`, background: near ? "var(--destructive)" : "var(--count-teal)" }}
        />
      </div>
      <span className={`shrink-0 text-[12px] tabular-nums ${near ? "text-destructive" : "text-muted-foreground"}`}>
        {usage.used} / {usage.limit} today
      </span>
    </div>
  );
}

/** True once the workspace has used today's allowance. */
export function useAllowanceSpent(): boolean {
  const usage = useQuery(api.ai.guard.usage, {});
  return usage !== undefined && usage.limit > 0 && usage.used >= usage.limit;
}
