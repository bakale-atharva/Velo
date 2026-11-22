import { StageGauge } from "@/components/issues/state-heading";

export type StateSlice = {
  key: string;
  label: string;
  /** Workflow state type; drives the tint and the gauge. */
  type: string;
  count: number;
};

/**
 * Where the work sits, as one 100% bar in the state tints (2px gaps between
 * slices, so even a tiny slice reads), with a ruled legend: gauge, name,
 * count and share. The tint never stands alone: every slice has a row that
 * names it.
 */
export function StateBar({ slices, unit = "issues" }: { slices: StateSlice[]; unit?: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.count, 0);
  const shown = slices.filter((slice) => slice.count > 0);
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden className="flex h-3 w-full gap-[2px]">
        {total === 0 ? (
          <span className="flex-1 bg-tile-edge" />
        ) : (
          shown.map((slice) => (
            <span
              key={slice.key}
              className="min-w-[3px]"
              style={{ flexGrow: slice.count, background: `var(--state-${slice.type})` }}
            />
          ))
        )}
      </div>
      <ul className="flex flex-col">
        {slices.map((slice) => (
          <li
            key={slice.key}
            className="grid h-9 grid-cols-[auto_minmax(0,1fr)_auto_3.5rem] items-center gap-3 border-b border-border text-[13px] last:border-b-0"
          >
            <StageGauge type={slice.type} />
            <span className="truncate">{slice.label}</span>
            <span className="data text-right text-[12px]">{slice.count}</span>
            <span className="data text-right text-[12px] text-muted-foreground">
              {total === 0 ? "—" : `${Math.round((slice.count / total) * 100)}%`}
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only">
        {total} {unit}: {slices.map((slice) => `${slice.label} ${slice.count}`).join(", ")}
      </span>
    </div>
  );
}
