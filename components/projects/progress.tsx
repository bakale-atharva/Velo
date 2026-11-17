/**
 * Completed over total as a rounded bar with the count beside it. The fill
 * is the done teal on a muted track; finished projects get no celebration.
 */
export function Progress({
  completed,
  total,
  className = "",
}: {
  completed: number;
  total: number;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${completed} of ${total} issues done`}
        className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]"
      >
        <div className="h-full rounded-full bg-count-teal" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-24 shrink-0 text-[13px] text-muted-foreground tabular-nums">
        {completed}/{total} · {percent}%
      </span>
    </div>
  );
}
