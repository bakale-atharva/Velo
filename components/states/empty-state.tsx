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
    <div className="max-w-md border-t-4 border-rule py-6">
      <h2 className="text-xl leading-6 font-semibold">{title}</h2>
      {children !== undefined && (
        <p className="mt-2 text-[13px] leading-5 text-muted-foreground">{children}</p>
      )}
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  );
}
