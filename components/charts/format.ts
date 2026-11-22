"use client";

import { useNow } from "@/components/issues/use-now";

export const DAY = 24 * 60 * 60 * 1000;

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

/** "05 JAN", in the data voice. Series buckets are UTC days and weeks. */
export function shortDate(ts: number): string {
  return SHORT_DATE.format(ts).toUpperCase();
}

/**
 * The start of today (UTC) for insight queries. It changes once a day, so the
 * query arguments stay fixed and the result stays cached and live.
 */
export function useToday(): number {
  const now = useNow();
  return Math.floor(now / DAY) * DAY;
}

/** "1 issue", "4 issues". */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
