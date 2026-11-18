const DUE_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
const DAY = 24 * 60 * 60 * 1000;

/**
 * A due date in the data voice: "DUE 16 MAY". Open work whose date has
 * passed reads "OVERDUE" in the destructive tone. `now` is passed in so
 * render stays pure. `fill` is accepted for older callers and ignored.
 */
export function DuePill({
  dueDate,
  finished,
  now,
}: {
  dueDate: number;
  finished: boolean;
  now: number;
  fill?: string;
}) {
  const overdue = !finished && dueDate < now - DAY;
  return (
    <span className="data inline-flex items-center gap-1.5 text-[12px] whitespace-nowrap uppercase">
      <span className={overdue ? "text-destructive" : ""}>{overdue ? "Overdue" : "Due"}</span>
      <span className="text-foreground group-focus-visible:text-background">{DUE_FORMAT.format(dueDate)}</span>
    </span>
  );
}
