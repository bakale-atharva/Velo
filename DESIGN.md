---
name: Velo
description: Keyboard-first issue tracker on soft floating panels; issues are warm grey tiles, colour marks state.
colors:
  canvas: "#e9e9e6"
  panel: "#f8f8f6"
  tile: "#ecebe7"
  tile-edge: "#f6f6f3"
  chip: "#e0dfda"
  popover: "#ffffff"
  ink: "#161818"
  primary: "#1b1d1d"
  muted: "#e9e8e4"
  muted-ink: "#62635e"
  border: "#e1e0dc"
  rule: "#d6d5d0"
  control-edge: "#8a8a84"
  ring: "#4f52c9"
  teal: "#12705f"
  orange: "#c8551a"
  urgent: "#e0442e"
  destructive: "#c4321b"
  state-backlog: "#a3a39d"
  state-unstarted: "#e9603f"
  state-started: "#6366d6"
  state-completed: "#12806f"
  night-canvas: "#0d0e0f"
  night-panel: "#161719"
  night-tile: "#1f2023"
  night-ink: "#ececea"
  night-muted-ink: "#a3a49e"
  night-ring: "#9c9eff"
typography:
  page-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "36px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: "28px"
  tile-title:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
  body:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "24px"
    fontFeature: "'tnum' 1"
  meta:
    fontFamily: "Figtree, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
rounded:
  control: "10px"
  row: "14px"
  tile: "20px"
  panel: "20px"
  dialog: "22px"
  pill: "999px"
spacing:
  shell-gap: "12px"
  page-x: "24px"
  panel-pad: "20px"
  tile-gap: "16px"
  column-gap: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 20px"
  button-outline:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  panel:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.panel}"
  issue-tile:
    backgroundColor: "{colors.tile}"
    rounded: "{rounded.tile}"
    padding: "20px"
  id-chip:
    backgroundColor: "{colors.chip}"
    textColor: "{colors.muted-ink}"
    rounded: "8px"
    height: "28px"
  title-chip:
    backgroundColor: "linear-gradient(160deg, #56645c, #2c3832)"
    textColor: "#f4f5f2"
    rounded: "10px"
    height: "32px"
---

# Design System: Velo

## Overview

**Creative North Star: "Soft Panels"**

Velo is a calm desk: a cool grey canvas with a few near-white panels floating on it, and the team's work laid out as warm grey tiles inside them. The sidebar, the top bar and every board column are separate panels with generous corners and a 12px gap of canvas between them. Nothing is boxed for the sake of it; a panel exists because it holds one thing (navigation, the breadcrumb, a state column, a group of rows).

Colour is rationed to jobs. Each workflow state owns one accent colour, shown as a short vertical bar beside its name. One iridescent ring (blue, violet, pink, peach, mint) marks dates and the Commands button, and the member card at the foot of the sidebar carries a warm wash behind the avatar. Everything else is greys and ink.

The visual direction follows the FLOW AI task dashboard reference the user chose (Dribbble shot 26265463). Velo keeps its own name, mark, content and keyboard-first behaviour.

**Key Characteristics:**
- Floating panels on a canvas, 12px apart; panels 20px radius, tiles 20px, rows 14px, controls 10px, primary buttons fully round.
- State is shown by a 3×24px accent bar plus a count chip, never by large coloured fills.
- Issue tiles: id chip, title, two-line excerpt, iridescent due pill, a seam, then the assignee footer.
- One dark gradient chip beside the page title; one dark pill for the primary action.
- Light and dark are both first-class and AA throughout.

## Colors

### Surfaces
- **Canvas** (`{colors.canvas}` / `{colors.night-canvas}`): the page ground behind every panel.
- **Panel** (`{colors.panel}` / `{colors.night-panel}`): sidebar, top bar, board columns, row groups, detail cards.
- **Tile** (`{colors.tile}` / `{colors.night-tile}`): issue tiles and row hover, sitting inside panels.
- **Tile edge** (`{colors.tile-edge}`): the 2px seam between a tile's body and its footer.
- **Chip** (`{colors.chip}`): identifier chips and the background of small labels on tiles.
- **Popover** (`{colors.popover}`): menus, dialogs, inputs.

### Ink
- **Ink** (`{colors.ink}` / `{colors.night-ink}`): all primary text.
- **Muted ink** (`{colors.muted-ink}` / `{colors.night-muted-ink}`): descriptions, meta, inactive nav (5.0:1 on tile, 5.6:1 on panel).
- **Control edge** (`{colors.control-edge}`): input and checkbox boundaries, 3.4:1 on panel.
- **Ring** (`{colors.ring}` / `{colors.night-ring}`): focus outlines, the caret, links.

### State accents
- Backlog and canceled `{colors.state-backlog}`, unstarted `{colors.state-unstarted}`, started `{colors.state-started}`, completed `{colors.state-completed}`. Used for the column bar, the properties bar and selection tint. Never as text.
- **Teal** (`{colors.teal}`): the title ring marker, the sidebar diamond, progress fill.
- **Urgent** (`{colors.urgent}`): the urgent priority ramp only.
- **Destructive** (`{colors.destructive}`): destructive actions, errors and "Overdue".

### Named rules
**The Bar Not Block Rule.** A state's colour appears as a thin bar or dot. If a surface would be filled with state colour, use a bar instead.

**The One Ring Rule.** The iridescent ring marks dates, the Commands button, the member card and "via assistant". It is never a general border.

## Typography

**Font:** Figtree for everything (variable, 300–900), Geist Mono only for code. Tabular figures are on globally.

- **Page title** (600, 36/40, -0.02em): the page's name, preceded by a teal ring marker.
- **Section** (500, 22/28): the heading over the board or list ("All issues").
- **Tile title** (500, 16/24): issue titles on tiles.
- **Body** (400, 15/24): rows, descriptions, Markdown.
- **Meta** (400, 13/20, muted): ids, dates, counts, estimates. Nothing functional below 12px.

## Layout

The shell is a 17.5rem floating sidebar panel and, to its right, a 68px top bar panel over the work field, all inset 12px from the window. Pages open with the header (ring marker, title, dark chip, diamond sub-page links hanging off an L-shaped connector, member avatars on the right) and a soft 3px rule that fades out to the right. Under it, a section title and a controls row: segmented List/Board toggle, a hairline divider, the dark "New …" pill, and filter pills on the right. Board columns are equal panels (min 300px) with 20px gaps; tiles stack 16px apart. Lists group rows into one panel per state. Page padding is 24px (12px on small screens).

## Elevation & Depth

Panels sit flat on the canvas with a faint inner highlight. Things that are lifted cast a soft, offset shadow: the primary pill (`--shadow-press`), the Commands button, the member card, popovers and dialogs (`--shadow-lift`), and a tile while it is being dragged.

## Shapes

Round and soft. 10px controls, 14px rows, 20px tiles and panels, 22px dialogs, full pills for the primary button, due pills and label tags. Avatars are circles. Diamonds (rotated squares) mark the current page in the sidebar and in header sub-nav.

## Components

### Buttons
- **Primary:** ink pill, 44px for page actions, with a leading circle-plus icon; soft press shadow. One per view.
- **Outline:** muted fill with a rule border, 10px corners (filters, Save view, Edit).
- **Ghost / destructive:** as shadcn, with destructive as a red wash.

### Segmented control
A muted track with a 4px inset; the selected option is a panel-coloured pill with a small shadow.

### Filter pills
40px, rule border on muted. A filter with a value turns into the dark gradient chip and shows its value.

### Issue tile (signature)
Warm grey tile, 20px corners. Top: id chip; title; two-line Markdown-stripped excerpt; the due pill when there is a date ("Due: 16 May", or a red "Overdue:" for open work past its date). A 2px seam, then the assignee avatar and name, estimate and priority ramp.

### State heading
3×24px accent bar, the state name at 15/500, and a count chip. Used for columns, list groups, cycles, views and sub-issues.

### Sidebar
Wordmark with the chevron mark, a Search field-link, nav items with icons (active item gets a tile fill), teams as collapsible groups whose pages hang off a vertical rule, with a teal diamond on the current page. The member card sits at the bottom.

### Priority ramp
Three rounded bars of rising height; urgent fills all three in urgent red; none is all faint.

## Do's and Don'ts

### Do:
- **Do** put content in panels on the canvas, and issues in tiles inside panels.
- **Do** mark state with the accent bar and a count chip.
- **Do** keep one dark primary pill per view.
- **Do** check new text colours for 4.5:1 on panel and tile, in both themes.

### Don't:
- **Don't** nest panels inside panels; inside a panel, use tiles or rows.
- **Don't** fill large areas with state colour, or set state colours as text.
- **Don't** use the iridescent ring as a general border.
- **Don't** copy the reference's brand, logo, names or illustrated avatars; Velo keeps its own identity.
