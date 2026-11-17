import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export type PageNavItem = { href: string; label: string; active: boolean };

/** A small diamond: filled for the current page, outlined otherwise. */
function Diamond({ filled }: { filled: boolean }) {
  return (
    <span
      aria-hidden
      className={`size-2 shrink-0 rotate-45 rounded-[1px] border-[1.5px] border-current ${filled ? "bg-current" : ""}`}
    />
  );
}

/** The bar glyph inside the dark title chip. */
function Bars() {
  return (
    <span aria-hidden className="inline-flex h-3 items-end gap-[2px]">
      {[6, 9, 12].map((height) => (
        <span key={height} className="w-[2.5px] rounded-full bg-current" style={{ height }} />
      ))}
    </span>
  );
}

/**
 * Page title with a ring marker, an optional dark chip (`subtitle`), sibling
 * pages as diamond links hanging off the marker, and anything on the right
 * (`actions`). A soft rule closes the header.
 */
export function TeamPageHeader({
  title,
  subtitle,
  nav,
  actions,
  back,
}: {
  title: string;
  subtitle?: string;
  nav?: PageNavItem[];
  actions?: React.ReactNode;
  /** The parent page, shown as a small pill above the title. */
  back?: { href: string; label: string };
}) {
  return (
    <header className="px-3 pt-8 md:px-6">
      {back !== undefined && (
        <nav aria-label="Breadcrumb" className="mb-4">
          <Link
            href={back.href}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-muted pr-3 pl-2 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <span aria-hidden className="size-[18px] shrink-0 rounded-full border-2 border-count-teal" />
            <h1 className="min-w-0 truncate text-[30px] leading-10 font-semibold tracking-[-0.02em] md:text-[36px]">
              {title}
            </h1>
            {subtitle !== undefined && (
              <span className="chip-dark inline-flex h-8 items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium whitespace-nowrap">
                <Bars />
                {subtitle}
              </span>
            )}
          </div>
          {nav !== undefined && (
            <div className="mt-1 ml-[8px] flex items-end gap-3">
              <span aria-hidden className="h-6 w-3 rounded-bl-[8px] border-b border-l border-input" />
              <nav aria-label="Pages" className="-mb-2.5 flex flex-wrap items-center gap-x-5 gap-y-1">
                {nav.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={item.active ? "page" : undefined}
                    className={`inline-flex h-8 items-center gap-2.5 rounded-lg text-[15px] ${
                      item.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Diamond filled={item.active} />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          )}
        </div>
        {actions !== undefined && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div aria-hidden className="mt-8 h-[3px] rounded-full bg-gradient-to-r from-rule via-rule to-transparent" />
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
    <section className="flex flex-1 flex-col px-3 pt-8 md:px-6">
      <h2 className="text-[22px] leading-7 font-medium tracking-[-0.01em]">{title}</h2>
      {controls !== undefined && <div className="mt-5 flex flex-wrap items-center gap-3">{controls}</div>}
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
