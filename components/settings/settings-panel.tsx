/**
 * One settings section: a panel with a title, a line on what it controls,
 * optional actions on the right, then its rows.
 */
export function SettingsPanel({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const id = `settings-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="panel max-w-4xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-[18px] leading-7 font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {description !== undefined && (
            <p className="mt-1 max-w-2xl text-[14px] leading-6 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children !== undefined && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** A label and its value on one line, used for read-only facts. */
export function SettingsFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4 rounded-[14px] px-3 py-2.5 text-[15px] even:bg-tile/50">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}
