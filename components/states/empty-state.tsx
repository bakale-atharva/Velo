/**
 * What a list shows when it has nothing in it: a flat, empty signal band
 * (the barcode with no events), what's missing, and what to do.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="max-w-xl border border-rule">
      <div
        aria-hidden
        className="h-8 border-b border-rule opacity-60"
        style={{ background: "repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 6px)" }}
      />
      <div className="p-6">
        <h2 className="text-[20px] leading-7 font-semibold tracking-[-0.02em]">{title}</h2>
        {children !== undefined && (
          <p className="mt-2 max-w-[60ch] text-[14px] leading-6 text-muted-foreground">{children}</p>
        )}
        {action !== undefined && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
