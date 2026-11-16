const LABELS = ["No priority", "Urgent", "High", "Medium", "Low"];

/**
 * Velo's one priority mark: three bars of rising height. High fills three,
 * medium two, low one; urgent fills all three in vermilion; none is all faint.
 */
export function PriorityRamp({ priority }: { priority: number }) {
  const filled = priority === 0 ? 0 : priority === 1 ? 3 : 5 - priority;
  return (
    <span
      role="img"
      aria-label={LABELS[priority] ?? LABELS[0]}
      className="inline-flex h-3 items-end gap-px"
    >
      {[4, 7, 10].map((height, index) => (
        <span
          key={height}
          className="w-[3px]"
          style={{
            height,
            background:
              index < filled
                ? priority === 1
                  ? "var(--urgent)"
                  : "var(--foreground)"
                : "var(--border)",
          }}
        />
      ))}
    </span>
  );
}
