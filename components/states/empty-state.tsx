/** What a list shows when it has nothing in it: what's missing and what to do. */
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
    <div className="panel max-w-lg p-7">
      <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em]">{title}</h2>
      {children !== undefined && (
        <p className="mt-2 text-[15px] leading-6 text-muted-foreground">{children}</p>
      )}
      {action !== undefined && <div className="mt-5">{action}</div>}
    </div>
  );
}
