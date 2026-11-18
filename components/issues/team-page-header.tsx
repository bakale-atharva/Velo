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
    <header className="pt-8">
      <div className="px-3 md:px-6">
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
          <div className="flex min-w-0 items-end gap-4">
            <h1 className="min-w-0 truncate text-[44px] leading-[0.95] font-semibold tracking-[-0.04em] md:text-[64px]">
              {title}
            </h1>
            {subtitle !== undefined && (
              <span className="inverted data mb-1.5 inline-flex h-6 items-center px-2 text-[12px] font-medium">
                {subtitle}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-6">
            {meta !== undefined && (
              <div className="data text-right text-[11px] leading-5 tracking-[0.14em] text-muted-foreground uppercase">
                {meta}
              </div>
            )}
            {actions}
          </div>
        </div>
      </div>
      {signal !== undefined && <div className="mt-6">{signal}</div>}
      {nav !== undefined ? (
        <nav aria-label="Pages" className="mt-4 flex gap-6 border-b border-rule px-3 md:px-6">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={`-mb-px border-b py-3 text-[14px] ${
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
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 pb-4 md:px-6">{controls}</div>
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
  ].map((item) => ({ ...item, active: pathname === item.href || pathname.startsWith(`${item.href}/`) }));
}
