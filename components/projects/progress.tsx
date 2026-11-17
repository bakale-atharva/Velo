/**
 * Completed over total as a flat bar with the count beside it. The bar is
 * ink on a muted track; finished projects keep the same ink, no celebration.
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
        className="h-1.5 min-w-16 flex-1 bg-muted"
      >
        <div className="h-full bg-foreground" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
        {completed}/{total} · {percent}%
      </span>
    </div>
  );
}
