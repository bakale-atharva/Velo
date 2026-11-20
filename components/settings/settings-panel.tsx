/**
 * One settings section, ruled off from the next: the title and a line on
 * what it controls on the left, actions and rows on the right. Collapses
 * to one column on narrow screens.
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
    <section
      aria-labelledby={id}
      className="grid max-w-6xl gap-x-12 gap-y-4 border-b border-rule py-8 first:pt-2 md:grid-cols-[260px_minmax(0,1fr)]"
    >
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] leading-6 font-semibold tracking-[-0.02em]">
          {title}
        </h2>
        {description !== undefined && (
          <p className="mt-1.5 text-[13.5px] leading-6 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0">
        {actions !== undefined && <div className="mb-4 flex flex-wrap items-center gap-2">{actions}</div>}
        {children}
      </div>
    </section>
  );
}

/** A label and its value on one ruled line, used for read-only facts. */
export function SettingsFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-4 border-b border-border py-2.5 text-[14px] first:border-t">
      <dt className="signal-label">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}
