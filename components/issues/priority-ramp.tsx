const LABELS = ["No priority", "Urgent", "High", "Medium", "Low"];

/**
 * Velo's priority mark: three hairline bars of rising height. High fills
 * three, medium two, low one; urgent is a solid block in the destructive
 * tone; none is all faint. Bars take the row's text colour, so they invert
 * with a focused row.
 */
export function PriorityRamp({ priority }: { priority: number }) {
  if (priority === 1) {
    return (
      <span
        role="img"
        aria-label={LABELS[1]}
        className="data grid size-3.5 place-items-center bg-urgent text-[9px] leading-none font-bold text-background"
      >
        !
      </span>
    );
  }
  const filled = priority === 0 ? 0 : 5 - priority;
  return (
    <span role="img" aria-label={LABELS[priority] ?? LABELS[0]} className="inline-flex h-3 items-end gap-[2px]">
      {[4, 8, 12].map((height, index) => (
        <span
          key={height}
          className={`w-[2px] ${index < filled ? "bg-current" : "bg-rule"}`}
          style={{ height }}
        />
      ))}
    </span>
  );
}
