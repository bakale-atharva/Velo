---
version: 1
slug: "app"
primary_target: "app"
related_targets: []
---

# Surface: Velo app (workspace shell, issue board/list, detail, settings)

Mode: Operate. Audience: engineers triaging work all day, keyboard first. Task: scan, create, move and update issues fast; live updates from teammates. Constraints: WCAG 2.2 AA, light and dark first-class, shadcn base components, Motion, Next.js 16.

## Direction contract

THESIS: Velo is a calm desk of soft floating panels; issues are tactile warm grey tiles and colour only marks state. It refuses dense hairline grids and saturated status fills.

OWN-WORLD: Grey canvas (#e9e9e6 / #0d0e0f), near-white panels (#f8f8f6) with 20px corners, warm grey tiles (#ecebe7), ink #161818. State accents as 3px bars: orange unstarted, indigo started, teal done. One iridescent ring for dates and the Commands button; a dark green-grey gradient chip beside titles; dark pill primary. Figtree throughout.

STORY: The engineer sees each state as its own panel, reads ids, titles and due dates on tiles, drags a tile or presses a key to move it, and watches counts update live.

FIRST VIEWPORT: Floating sidebar (mark + Velo, Search, My issues/Projects/Views, collapsible teams with diamond marker, member card). Top bar panel: Workspace pill › org switcher, iridescent Commands ⌘K right. Header: teal ring, team name, dark key chip, ◆ Issues ◇ Cycles off an L connector, avatar stack right; fading rule. "All issues" section, List/Board segmented, divider, dark New issue pill, filter pills right. Board columns as panels of tiles.

FORM: Brief-pinned by the user (FLOW AI task dashboard reference, Dribbble 26265463); no concept roll. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
