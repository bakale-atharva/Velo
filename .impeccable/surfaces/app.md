---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface: Velo app (workspace shell, issue board/list, detail, settings)

Mode: Operate. Audience: engineers triaging work all day, keyboard first. Task: scan, create, move and update issues fast; live updates from teammates. Constraints: WCAG 2.2 AA, light and dark first-class, shadcn base components, Motion, Next.js 16.

## Direction contract

THESIS: Velo is set on one strict Swiss modular grid: hierarchy comes from scale, weight and position on the grid, never from boxes, cards or shadows. It refuses the category default of grey sidebar, rounded cards and coloured status dots.

OWN-WORLD: Paper ground (#f6f6f2 light, near-black #111214 dark), ink #121212, a committed ultramarine (#2433d6) shell rail, vermilion (#e8432a) reserved for urgent and destructive. Neo-grotesk UI (Geist) with tabular figures; a condensed heavy grotesk (Archivo, 75–80% width, 800) only for poster-scale numerals and page titles. Hairline rules on an 8px baseline; 4px heavy rules head columns. Square corners (2px max). Priority is one fixed bar ramp everywhere (raised from Star Atlas); ids, counts, estimates, dates are tabular and column-aligned (raised from Datamatics); every edge snaps to the visible 8px grid (raised from Crouwel).

STORY: The engineer sees their team's whole state at a glance, reads counts before titles, moves an issue with a keystroke or drag and watches the count tick for everyone at once.

FIRST VIEWPORT: Left 232px ultramarine rail: wordmark + workspace, My issues, Projects, Views, Search, Teams list, Settings and command hint at the bottom. Main: page title in condensed grotesk 48px with a hairline under it and actions right (view toggle, Filter, primary New issue in ink). A thin filter bar. Board: equal state columns, each headed by name and a 64px condensed live count on a 4px rule (started state in ultramarine, finished states greyed); issue rows separated by hairlines: identifier, priority ramp, title, labels as outlined tags, estimate, assignee initials. Selected row: white fill and ultramarine 3px inset edge.

FORM: Swiss Grid (International Typographic Style posters), candidate 4 of 7 on the ordered list; seed:1f22190eca198567. Signature move: poster-scale state counts that tick live as issues move (Motion number roll, instant under reduced motion).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
