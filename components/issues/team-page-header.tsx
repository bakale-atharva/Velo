/** Page title over a 1px ink rule, with actions on the right. */
export function TeamPageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-rule px-8 pt-6 pb-4">
      <h1 className="font-display text-[48px] leading-[48px] font-extrabold tracking-[-0.03em] [font-stretch:80%]">
        {title}
        {subtitle !== undefined && <span className="text-muted-foreground"> {subtitle}</span>}
      </h1>
      {actions !== undefined && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
