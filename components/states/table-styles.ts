// Shared Datamatics table classes for full-width data lists (projects,
// cycles, views, search). Combine with a grid-cols template per page.

/** The table: full width, opened by a hairline under the page header. */
export const TABLE = "mb-12 flex flex-col";

/** Column headers: small tracked mono labels on a hairline. */
export const TABLE_HEAD =
  "data h-9 items-center border-b border-rule px-3 text-[11px] tracking-[0.14em] text-muted-foreground uppercase @3xl/main:px-6";

/** A row: hairline under it, tile on hover, full inversion when focused (the active path). */
export const TABLE_ROW =
  "group relative items-center border-b border-border px-3 hover:bg-tile focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none @3xl/main:px-6";

/** Secondary text inside a row that must invert with it. */
export const ROW_MUTED = "text-muted-foreground group-focus-visible:text-background";
