---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface: Velo app (workspace shell, issue board/list, detail, settings)

Mode: Operate. Audience: engineers triaging work all day, keyboard first. Task: scan, create, move and update issues fast; live updates from teammates. Constraints: WCAG 2.2 AA, dark first with a first-class light theme (the light theme is the exact inversion), shadcn base components, Motion, Next.js 16. Borrowing Linear's interaction patterns and density is allowed.

## Direction contract

THESIS: Velo as data-sublime: pure black and white at data density, where the team's work is literally visible as signal. It refuses the grey-panel-plus-one-accent dark default and soft rounded cards.

OWN-WORLD: Pure black ground, pure white ink, greys only as steps of the same signal (#000, #0a0a0a, #1a1a1a, #333, #6b6b6b, #a3a3a3, #fff). One monospace family for data (ids, numbers, labels, timestamps, shortcuts) beside one tight grotesk for titles and headings. Hairline 1px rules, square or 2px corners, no shadows, no gradients. Five muted state tints (backlog, unstarted, started, completed, canceled) as the only hue, small and desaturated, always paired with a bar-pattern glyph. Selection and the active path are full inversion: white row, black text.

STORY: The engineer reads the team's pulse from the activity barcode, scans dense tabular rows by id and stage gauge, moves through them with J/K as the inverted row travels, and sees a teammate's change land as a single frame of inversion.

FIRST VIEWPORT: Left rail (wordmark VELO, search ⌘K, My issues, Projects, Views, Assistant ⌘J, teams by key). Team header: huge tight team name left, mono meta right (issue count, events in 7 days, cycle points). Under it the signature: a full-width live barcode where each hairline bar is one issue event over the last 7 days, with a mono day scale. Tabs (Issues, Board, Cycles, Projects), filter chips, New issue as a white block. Below, a tabular list grouped by state: id, stage gauge, title, labels, priority numeral, estimate, assignee.

FORM: Challenger ikeda-datamatics (dealt challenger, verdict competitive, chosen by the user over the assigned Signal Field). Raises kept: fixed-scale stage gauge on every row; identifiers as typeable coordinates; cycle capacity bar that visibly overflows; inversion reserved for the active path. seed:278b4470ff29ac25

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
