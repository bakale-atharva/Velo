"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useNow } from "./use-now";

const DAY = 24 * 60 * 60 * 1000;
const DAYS = 7;
const BUCKETS = DAYS * 48; // one bar slot per 30 minutes
const DAY_NAME = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

/**
 * Velo's signature: the team's last seven days as a barcode. Every hairline
 * is a moment an issue was created or completed; the bar's weight is how
 * many landed in that half hour. Completions draw full height, creations
 * three quarters, so the rhythm of work in and work out reads at a glance.
 * Shares the list's subscription (same query and arguments).
 */
export function ActivityBarcode({ teamId }: { teamId: Id<"teams"> }) {
  const { results, status } = usePaginatedQuery(api.issues.listByTeam, { teamId }, { initialNumItems: 100 });
  const now = useNow();
  const start = now - DAYS * DAY;
  const slot = (DAYS * DAY) / BUCKETS;
  const created = new Array<number>(BUCKETS).fill(0);
  const completed = new Array<number>(BUCKETS).fill(0);
  for (const issue of results) {
    if (issue._creationTime >= start) created[Math.min(BUCKETS - 1, Math.floor((issue._creationTime - start) / slot))]++;
    if (issue.completedAt !== null && issue.completedAt >= start) {
      completed[Math.min(BUCKETS - 1, Math.floor((issue.completedAt - start) / slot))]++;
    }
  }
  const events = created.reduce((a, b) => a + b, 0) + completed.reduce((a, b) => a + b, 0);
  const days = Array.from({ length: DAYS }, (_, index) => DAY_NAME.format(start + index * DAY));

  return (
    <figure className="px-3 md:px-6" aria-label={`${events} issues created or completed in the last 7 days`}>
      <div className="relative h-16 overflow-hidden border-y border-rule">
        {/* Faint scan lines keep the field alive when the week is quiet. */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-40"
          style={{ background: "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 6px)" }}
        />
        {status !== "LoadingFirstPage" && (
          <svg
            aria-hidden
            viewBox={`0 0 ${BUCKETS} 100`}
            preserveAspectRatio="none"
            className="absolute inset-0 size-full text-foreground"
          >
            {created.map((count, index) =>
              count === 0 ? null : (
                <rect key={`c${index}`} x={index} y={25} width={Math.min(1, 0.35 * count)} height={75} fill="currentColor" opacity={0.55} />
              ),
            )}
            {completed.map((count, index) =>
              count === 0 ? null : (
                <rect key={`d${index}`} x={index + 0.5} y={0} width={Math.min(1, 0.35 * count)} height={100} fill="currentColor" />
              ),
            )}
          </svg>
        )}
      </div>
      <figcaption className="signal-label flex justify-between pt-2 text-[10px]">
        {days.map((day, index) => (
          <span key={index}>{day}</span>
        ))}
        <span className="text-foreground">Now</span>
      </figcaption>
    </figure>
  );
}
