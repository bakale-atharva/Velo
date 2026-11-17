const DUE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const DAY = 24 * 60 * 60 * 1000;

/**
 * "Due: 16 May" in an iridescent ring. Open work whose date has passed reads
 * "Overdue". `now` is passed in so render stays pure.
 */
export function DuePill({
  dueDate,
  finished,
  now,
  fill = "var(--tile)",
}: {
  dueDate: number;
  finished: boolean;
  now: number;
  fill?: string;
}) {
  const overdue = !finished && dueDate < now - DAY;
  return (
    <span
      className="iris-ring inline-flex h-9 items-center gap-1 rounded-full px-4 text-[13px] whitespace-nowrap text-muted-foreground shadow-[0_2px_6px_-2px_rgb(20_22_22/0.15)]"
      style={{ "--iris-fill": fill } as React.CSSProperties}
    >
      {overdue ? <span className="font-medium text-destructive">Overdue:</span> : "Due:"}
      <span className="font-medium text-foreground">{DUE_FORMAT.format(dueDate)}</span>
    </span>
  );
}
