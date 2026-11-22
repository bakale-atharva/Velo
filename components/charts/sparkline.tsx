/**
 * A tiny bar series for a table cell: one hairline-wide column per bucket,
 * height by count, the latest bucket in full ink and the rest at 55%. Empty
 * buckets show as a 1px floor so the rhythm stays visible. Draws in
 * currentColor, so it inverts with a focused row.
 */
export function Sparkline({
  values,
  label,
  width = 72,
  height = 18,
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  const max = Math.max(1, ...values);
  const slot = width / Math.max(1, values.length);
  const bar = Math.max(1, slot - 2);
  return (
    <svg role="img" aria-label={label} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      {values.map((value, index) => {
        const h = value === 0 ? 1 : Math.max(2, (value / max) * height);
        return (
          <rect
            key={index}
            x={index * slot}
            y={height - h}
            width={bar}
            height={h}
            fill="currentColor"
            opacity={value === 0 ? 0.2 : index === values.length - 1 ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}
