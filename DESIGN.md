---
name: Velo
description: Datamatics. Pure black and white at data density; the team's work is visible as signal, and the active path inverts.
colors:
  ground: "#000000"
  ink: "#ffffff"
  tile: "#0d0d0d"
  popover: "#0a0a0a"
  chip: "#1a1a1a"
  muted: "#141414"
  border: "#1f1f1f"
  rule: "#333333"
  input: "#737373"
  faint: "#6b6b6b"
  muted-ink: "#a3a3a3"
  destructive: "#e07a6c"
  state-backlog: "#6b6b6b"
  state-unstarted: "#b8a27a"
  state-started: "#8aa3c7"
  state-completed: "#86b29a"
  state-canceled: "#4d4d4d"
  light-ground: "#ffffff"
  light-ink: "#000000"
  light-muted-ink: "#5c5c5c"
  light-rule: "#cccccc"
  light-destructive: "#a8372a"
  light-state-unstarted: "#8a7550"
  light-state-started: "#4f6a8f"
  light-state-completed: "#4e7a62"
typography:
  page-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.04em"
  issue-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 600
    lineHeight: "40px"
    letterSpacing: "-0.035em"
  section-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: "24px"
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "24px"
    letterSpacing: "0em"
  data:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.02em"
  signal-label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.18em"
rounded:
  none: "0px"
  sm: "1px"
  md: "2px"
  avatar: "9999px"
spacing:
  gutter-mobile: "12px"
  gutter: "24px"
  row: "40px"
  row-table: "44px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
  issue-row:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "{spacing.row}"
  issue-row-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    height: "{spacing.row}"
  table-head:
    textColor: "{colors.muted-ink}"
    typography: "{typography.signal-label}"
    height: "36px"
  key-block:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    typography: "{typography.data}"
    height: "24px"
    padding: "0 8px"
---

# Design System: Velo

## Overview

Velo is an issue tracker that engineers run their day in, so the screens are working tools: dense, keyboard-first, live. The visual world is **Datamatics**, after Ryoji Ikeda's data-sublime installations: pure black and white, hairline rules, monospace data, and the team's own activity drawn as signal. Dark is the default theme; light is the exact inversion and equally first-class.

The system has three signature moves and everything else stays quiet:

1. **The activity barcode.** Each team page opens with the last seven days drawn as hairline bars, one for every issue created or completed. The Velo mark is the same signal shaped into a V.
2. **Inversion is the active path.** The focused or selected row, the chosen segment, the drag card and primary marks become a white block with black text. Nothing else uses inversion.
3. **The signal flash.** When a live change lands on a row, it inverts for two frames (about half a second) through a difference-blend layer.

Borrowing Linear's interaction patterns and density is explicitly allowed; Velo keeps its own mark, world and signature moves.

## Colors

The palette is a single signal scale from ground to ink, plus five muted state tints. There is no accent hue.

### Neutral
- **Ground** `{colors.ground}` is the page. **Ink** `{colors.ink}` is all primary text and every inverted block.
- **Tile** `{colors.tile}` is the hover wash on rows. **Chip** `{colors.chip}` and **Muted** `{colors.muted}` fill quiet controls.
- **Border** `{colors.border}` rules rows; **Rule** `{colors.rule}` rules sections and frames; **Input** `{colors.input}` outlines controls (4.4:1).
- **Muted ink** `{colors.muted-ink}` (8.6:1) carries secondary text; **Faint** `{colors.faint}` only marks separators and text 14px and up.

### State tints
Backlog, unstarted, started, completed and canceled each have one small, desaturated tint (`state-*`). They appear only as the stage-gauge cells, label squares and status squares, never as fills behind text and never alone: every tint is paired with the gauge's fill count or a text label.

### Destructive
`{colors.destructive}` (light `{colors.light-destructive}`) marks urgent priority, overdue dates, destructive buttons and errors. It is the only warm signal and stays rare.

### Named Rules
- **The No-Accent Rule.** Emphasis comes from inversion, weight and size, never from a brand hue.
- **The Exact Inversion Rule.** Light theme swaps ground and ink and darkens the state tints to stay 3:1 as marks; nothing else changes.

## Typography

Two faces from one family. **Geist** sets titles and UI text; **Geist Mono** sets all data: issue ids, dates, estimates, counts, shortcuts and section labels. Numerals are tabular everywhere.

### Hierarchy
- **Page title** (64px, -0.04em, 0.95 line height): team names, Projects, Settings. Set large and tight; 44px on phones.
- **Issue title** (34px, -0.035em): the issue page's editable title.
- **Section title** (17px semibold): settings sections, empty and error states.
- **Body** (14px, 24px line height): rows, descriptions, dialogs. Markdown runs at 14.5px with a 72ch measure.
- **Data** (Geist Mono 12px): ids, dates, estimates, counts.
- **Signal label** (Geist Mono 11px, 0.18em, uppercase): group headings like `IN PROGRESS / 04`, table headers, property labels.

### Named Rules
- **The Data Voice Rule.** If it is an identifier, a number, a date or a key, it is mono. Prose is never mono.

## Layout

- The shell is flush: a 240px sidebar ruled off by a hairline, a 48px top strip, then the work field edge to edge. Content uses a 12px gutter on narrow work fields and 24px from `@3xl/main` up.
- Layout inside the workspace responds to the work field's width, not the viewport: the work field is `@container/main` and the top strip `@container/top`. Use `@xl/main` (36rem) where a viewport `sm:` would go and `@3xl/main` (48rem) for `md:` and `lg:` splits; at desktop widths with the sidebar open these resolve the same as before. Only the sidebar (a sheet below `md`), its trigger, and portaled overlays (dialogs, sheets, popovers) stay on viewport breakpoints.
- On narrow work fields issue rows drop the stage gauge, figure strips fold into ruled grids, and page tabs scroll sideways. The board snaps column by column; on touch a swipe scrolls and a long press (250ms) picks a card up. Shortcut hints are hidden on coarse pointers.
- Lists are full-width tables: 40px issue rows, 44px rows elsewhere, a hairline under each, groups opened by a section rule and a signal label.
- Detail pages split into the content column and a 320px properties column behind a vertical hairline.
- Facts render as figure strips: equal cells divided by vertical hairlines, a signal label over a large mono value.
- Settings sections are two columns (260px title and description, then controls), stacked and ruled.

## Elevation & Depth

There is no depth system. Layers separate by hairlines (`border`, `rule`), never by shadows, gradients or blur. Popovers, dialogs, sheets and menus are framed with a 1px `rule` ring on `popover`. Clerk surfaces are restyled the same way.

## Shapes

Square. Controls take 2px corners at most; frames, rows, panels and dialogs take none. Avatars are the only round elements, and photos render in grayscale.

## Components

### Buttons
- **Primary:** ink block, ground text, 36px tall, 2px corners; hover drops to 85% ink.
- **Outline:** 1px `rule` border on the ground; the border turns ink on hover.
- **Destructive:** 1px destructive border and text; fills destructive on hover.
- **Ghost:** text only; muted wash on hover. Focus everywhere is a 1px ink outline offset 2px.

### Inputs / Fields
1px `input` border, 2px corners, ground fill. Field labels are signal labels. The search page uses one large 22px input on a single underline that turns ink on focus.

### Navigation
- **Sidebar:** 32px rows at 13.5px with muted icons and mono shortcut hints (`G I`, `⌘J`). The current page inverts. Teams show their key in mono.
- **Page tabs:** text links on the header's bottom rule; the active tab carries a 1px ink underline.
- **Segmented controls** (List/Board, theme): hairline frame, mono caps, chosen cell inverted.

### Issue row
id (mono) · stage gauge · priority ramp · title with label squares · due · estimate · avatar. Hover washes `tile`; focus inverts the whole row, including the gauge and ramp, which draw in `currentColor`.

### Stage gauge
Five 9×7px cells in the state's tint: backlog fills one, unstarted two, started three, completed five; canceled is one hatched cell. Empty cells are 16% of the current text colour, so they invert with the row.

### Priority ramp
Three 2px bars of rising height in `currentColor`; urgent is a solid destructive square with a mono "!".

### Activity barcode (signature)
A 64px band between two section rules: completions full height, creations three quarters at 55% opacity, faint scan lines behind, a mono day scale below. Built only from real issue timestamps.

### Progress and usage
Rows of hairline ticks (24 for progress, 40 for assistant usage) with a mono count; used ticks draw in ink, or destructive near a limit.

### Assistant
Your messages are inverted blocks aligned right; replies sit behind a 1px left rule. Pending proposals have an ink frame; resolved ones a faint frame.

### States
Empty states are a ruled frame topped by an empty signal band. Errors take a destructive frame. Loading skeletons mirror the table rows.

## Do's and Don'ts

### Do:
- **Do** separate everything with 1px hairlines (`border` for rows, `rule` for sections and frames).
- **Do** set every id, date, count, estimate and key in Geist Mono.
- **Do** reserve inversion for the active path: focus, selection, the chosen segment, the dragged card, primary buttons, key blocks.
- **Do** pair every state tint with the stage gauge or a text label.
- **Do** keep page titles large and tight (64px, -0.04em) against small, dense data.

### Don't:
- **Don't** add shadows, gradients, glass or blur to any surface.
- **Don't** round anything past 2px except avatars.
- **Don't** introduce an accent hue; use inversion, weight or size.
- **Don't** fill a surface with a state tint or put text on one.
- **Don't** draw the barcode or any chart from invented data; label decorative fields as illustration.
