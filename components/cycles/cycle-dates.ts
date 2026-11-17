import type { Doc } from "@/convex/_generated/dataModel";
import { formatRange } from "@/lib/dates";

export const DAY = 86_400_000;

// A cycle covers [startsAt, endsAt): it ends at midnight after its last day.

/** "Nov 3 – Nov 16", naming the last day rather than the exclusive end. */
export function cycleRange(cycle: Pick<Doc<"cycles">, "startsAt" | "endsAt">): string {
  return formatRange(cycle.startsAt, cycle.endsAt - DAY);
}

/** Whole days left until the cycle ends, never negative. */
export function daysLeft(cycle: Pick<Doc<"cycles">, "endsAt">, now: number): number {
  return Math.max(0, Math.ceil((cycle.endsAt - now) / DAY));
}

/** The other cycle a range would overlap, if any. */
export function overlapping(
  cycles: Doc<"cycles">[],
  startsAt: number,
  endsAt: number,
  except?: Doc<"cycles">["_id"],
): Doc<"cycles"> | undefined {
  return cycles.find(
    (cycle) => cycle._id !== except && cycle.startsAt < endsAt && startsAt < cycle.endsAt,
  );
}
