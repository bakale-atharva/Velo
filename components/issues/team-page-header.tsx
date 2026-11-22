import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export type PageNavItem = { href: string; label: string; active: boolean };

/**
 * Page title set large and tight, an optional key in an inverted block
 * (`subtitle`), data-voice facts on the right (`meta`), anything else on the
 * right (`actions`), sibling pages as underlined tabs, and an optional
 * signal band (`signal`) such as the activity barcode.
 */
export function TeamPageHeader({
  title,
  subtitle,
  meta,
  nav,
  actions,
  back,
  signal,
}: {
  title: string;
  subtitle?: string;
  meta?: React.ReactNode;
  nav?: PageNavItem[];
  actions?: React.ReactNode;
  /** The parent page, shown as a small link above the title. */
  back?: { href: string; label: string };
  signal?: React.ReactNode;
}) {
  return (
    <header className="pt-6 @3xl/main:pt-8">
      <div className="px-3 @3xl/main:px-6">
        {back !== undefined && (
          <nav aria-label="Breadcrumb" className="mb-4">
            <Link
              href={back.href}
              className="signal-label inline-flex items-center gap-2 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              {back.label}
            </Link>
          </nav>
        )}
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="flex min-w-0 max-w-full items-end gap-4">
            <h1 className="min-w-0 truncate text-[36px] leading-[0.95] font-semibold tracking-[-0.04em] @md/main:text-[44px] @3xl/main:text-[64px]">
              {title}
            </h1>
            {subtitle !== undefined && (
              <span className="inverted data mb-1.5 inline-flex h-6 items-center px-2 text-[12px] font-medium">
                {subtitle}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {meta !== undefined && (
              <div className="data text-left @3xl/main:text-right text-[11px] leading-5 tracking-[0.14em] text-muted-foreground uppercase">
                {meta}
              </div>
            )}
            {actions}
          </div>
        </div>
      </div>
      {signal !== undefined && <div className="mt-6">{signal}</div>}
      {nav !== undefined ? (
        // Tabs scroll sideways when they outrun the work field (settings has eight).
        <nav
          aria-label="Pages"
          className="mt-4 flex scroll-px-3 gap-6 overflow-x-auto border-b border-rule px-3 [scrollbar-width:none] @3xl/main:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`-mb-px shrink-0 border-b py-3 text-[14px] whitespace-nowrap ${
                item.active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : (
        <div aria-hidden className="mt-6 border-b border-rule" />
      )}
    </header>
  );
}

/** A section heading with its controls in a row beneath, as on the team page. */
export function PageSection({
  title,
  controls,
  children,
}: {
  title: string;
  controls?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-1 flex-col pt-4">
      <h2 className="sr-only">{title}</h2>
      {controls !== undefined && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 pb-4 @3xl/main:px-6">{controls}</div>
      )}
      {children}
    </section>
  );
}

/** Team pages as header nav items. */
export function teamNav(orgSlug: string, teamKey: string, pathname: string): PageNavItem[] {
  const base = `/${orgSlug}/team/${teamKey}`;
  return [
    { href: `${base}/issues`, label: "Issues" },
    { href: `${base}/cycles`, label: "Cycles" },
    { href: `${base}/insights`, label: "Insights" },
  ].map((item) => ({ ...item, active: pathname === item.href || pathname.startsWith(`${item.href}/`) }));
}
