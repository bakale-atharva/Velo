export type BarListRow = {
  key: string;
  label: React.ReactNode;
  count: number;
};

/**
 * Horizontal bars as a ruled list: label, a 1px-tall track with an ink bar
 * scaled to the largest row, and the count in mono. Reads at any width
 * because the bar takes whatever room is left.
 */
export function BarList({ rows }: { rows: BarListRow[] }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid h-10 grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2.5rem] items-center gap-3 border-b border-border last:border-b-0"
        >
          <span className="flex min-w-0 items-center gap-2 text-[13px]">{row.label}</span>
          <span aria-hidden className="relative h-2">
            <span className="absolute inset-y-0 left-0 bg-foreground" style={{ width: `${(row.count / max) * 100}%` }} />
            <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          </span>
          <span className="data text-right text-[12px]">{row.count}</span>
        </li>
      ))}
    </ul>
  );
}
