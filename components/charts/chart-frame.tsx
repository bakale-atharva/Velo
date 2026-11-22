const SCAN_LINES = "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 6px)";

/**
 * A chart as a figure: a signal label, an optional big mono figure beside it,
 * the chart, and a mono footnote. `summary` is the sentence screen readers get
 * (the drawing itself is decorative). With `empty`, the chart gives way to a
 * flat band of scan lines and the empty message — never placeholder bars.
 */
export function ChartFrame({
  title,
  summary,
  figure,
  figureLabel,
  empty = false,
  emptyText = "Nothing to show yet.",
  footnote,
  loading = false,
  className = "",
  children,
}: {
  title: string;
  summary: string;
  figure?: React.ReactNode;
  figureLabel?: string;
  empty?: boolean;
  emptyText?: string;
  footnote?: React.ReactNode;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure aria-label={loading ? `${title}, loading` : summary} className={`flex min-w-0 flex-col ${className}`}>
      <div className="flex items-end justify-between gap-4 pb-4">
        <figcaption className="signal-label">{title}</figcaption>
        {figure !== undefined && !loading && (
          <span className="flex items-baseline gap-2">
            {figureLabel !== undefined && <span className="signal-label text-[10px]">{figureLabel}</span>}
            <span className="data text-[22px] leading-none tracking-[-0.02em] text-foreground">{figure}</span>
          </span>
        )}
      </div>
      <div aria-hidden className="relative">
        {loading ? (
          <div className="h-40 animate-pulse border-y border-border bg-tile @3xl/main:h-48" />
        ) : empty ? (
          <div className="flex h-40 items-end border-y border-rule @3xl/main:h-48" style={{ background: SCAN_LINES }}>
            <p className="data bg-background px-2 py-1 text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
              {emptyText}
            </p>
          </div>
        ) : (
          children
        )}
      </div>
      {footnote !== undefined && !loading && (
        <p className="data pt-3 text-[11px] tracking-[0.04em] text-muted-foreground">{footnote}</p>
      )}
    </figure>
  );
}

/** A grid of chart panels, ruled like a figure strip: one column narrow, two from 48rem. */
export function ChartGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 border-t border-rule @3xl/main:grid-cols-2 [&>*]:border-b [&>*]:border-rule [&>*]:px-3 [&>*]:py-6 @3xl/main:[&>*]:px-6 @3xl/main:[&>*:nth-child(odd)]:border-r">
      {children}
    </div>
  );
}
