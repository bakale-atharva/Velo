const TICKS = 24;

/**
 * Completed over total as a row of hairline ticks: done ticks in full ink,
 * the rest faint, with the count beside it in the data voice. Takes the
 * current text colour, so it inverts with a focused row.
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
  const filled = Math.round((percent / 100) * TICKS);
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${completed} of ${total} issues done`}
        className="flex h-3 min-w-16 flex-1 items-stretch justify-between"
      >
        {Array.from({ length: TICKS }, (_, index) => (
          <span key={index} className={`w-px ${index < filled ? "bg-current" : "bg-rule"}`} />
        ))}
      </div>
      <span className="data w-24 shrink-0 text-[11px] opacity-70">
        {completed}/{total} · {percent}%
      </span>
    </div>
  );
}
