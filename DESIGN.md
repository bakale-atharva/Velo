---
name: Velo
description: Keyboard-first issue tracker set on one Swiss grid; live counts read like a departure board.
colors:
  paper: "#f6f6f2"
  ink: "#121212"
  raised: "#ffffff"
  muted: "#ecece6"
  muted-ink: "#55554f"
  secondary: "#e9e9e3"
  hairline: "#d9d9d2"
  control-edge: "#85857e"
  ultramarine: "#2433d6"
  vermilion: "#e8432a"
  destructive: "#c4321b"
  state-completed: "#2c7a4b"
  night: "#111214"
  night-raised: "#1a1b1e"
  night-ink: "#ecece6"
  night-muted-ink: "#a4a49d"
  night-hairline: "#2d2e33"
  night-ultramarine: "#1d29b8"
  night-ultramarine-ink: "#8c96ff"
  night-vermilion: "#ff6b52"
typography:
  display:
    fontFamily: "Archivo, Geist, sans-serif"
    fontSize: "64px"
    fontWeight: 800
    lineHeight: "56px"
    letterSpacing: "-0.04em"
    fontVariation: "'wdth' 75"
  headline:
    fontFamily: "Archivo, Geist, sans-serif"
    fontSize: "48px"
    fontWeight: 800
    lineHeight: "48px"
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 80"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: "24px"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "16px"
    fontFeature: "'tnum' 1, 'ss01' 1"
  meta:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0.08em"
rounded:
  hairline: "1px"
  square: "2px"
spacing:
  grid: "8px"
  half: "4px"
  gutter: "16px"
  page: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    height: "32px"
    padding: "0 10px"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    height: "32px"
    padding: "0 10px"
  button-destructive:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.destructive}"
    rounded: "{rounded.square}"
    height: "32px"
    padding: "0 10px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    height: "32px"
    padding: "0 10px"
  rail:
    backgroundColor: "{colors.ultramarine}"
    textColor: "{colors.raised}"
    width: "232px"
  rail-item-active:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ultramarine}"
    rounded: "{rounded.square}"
    padding: "8px"
  tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 4px"
---

# Design System: Velo

## Overview

**Creative North Star: "The Departure Board"**

Velo reads like a station departure board set by a Zürich typographer: a whole team's work visible at a glance, numbers that change in place while you watch, and nothing on the surface that is not information. Every issue sits on one strict modular grid; hierarchy comes from scale, weight and position, never from boxes, cards or shadows.

The board's columns are headed by poster-scale counts in a condensed heavy grotesk. They are the loudest thing on the screen and the only decorative act the system allows, because they are also the most useful number on it. Beneath them the rows are quiet and dense: a neo-grotesk at 13px with tabular figures, hairlines on the 8px grid, identifiers and estimates in their own aligned columns.

Colour does jobs, not decoration. Paper and ink carry the reading; a committed ultramarine owns the shell rail and marks work in progress; vermilion appears only where something is urgent or destructive.

**Key Characteristics:**
- One Swiss modular grid on an 8px baseline; every edge lands on it.
- Poster-scale condensed counts over quiet, dense rows.
- Ultramarine shell, paper-and-ink field, vermilion only for urgent and destructive.
- Square corners (2px at most), hairline rules, no shadows on the page.
- Light and dark are both first-class and AA throughout.

## Colors

A paper-and-ink field with one committed blue and one rationed red.

### Primary
- **Zürich Ultramarine** (`{colors.ultramarine}`, dark `{colors.night-ultramarine}`): the whole navigation rail, text selection, the focus ring, the caret, and the "started" workflow state. As text on paper it uses the same value (7.3:1); on night it lifts to `{colors.night-ultramarine-ink}`.

### Secondary
- **Signal Vermilion** (`{colors.vermilion}`, dark `{colors.night-vermilion}`): urgent priority bars and fills only. It is never set as body text on paper.
- **Ledger Red** (`{colors.destructive}`): destructive actions and validation errors, as text or outline (5.1:1 on paper).

### Neutral
- **Paper** (`{colors.paper}`) / **Night** (`{colors.night}`): the page ground.
- **Ink** (`{colors.ink}`) / **Night Ink** (`{colors.night-ink}`): all primary text, the primary button fill, heavy 4px column rules.
- **Raised White** (`{colors.raised}`) / **Night Raised** (`{colors.night-raised}`): popovers, dialogs, the selected row.
- **Graphite** (`{colors.muted-ink}`) / **Night Graphite** (`{colors.night-muted-ink}`): metadata, identifiers, labels (6.9:1 / 7.7:1).
- **Hairline** (`{colors.hairline}`) / **Night Hairline** (`{colors.night-hairline}`): row dividers and grid rules; decorative only.
- **Control Edge** (`{colors.control-edge}`): input and checkbox boundaries, at 3.6:1 so controls stay findable.
- **Done Green** (`{colors.state-completed}`): the completed state rule and marker.

### Named Rules
**The Rationed Red Rule.** Vermilion marks urgency and nothing else. If a screen has no urgent issue, it has no vermilion.

**The Blue Means Moving Rule.** Ultramarine inside the work area means "in progress". Never use it for decoration, links in prose, or unrelated emphasis.

## Typography

**Display Font:** Archivo (variable width, used at 75–80% width, 800 weight)
**Body Font:** Geist (with ui-sans-serif, system-ui)
**Label/Mono Font:** Geist Mono, only for code and token names

**Character:** A condensed, heavy grotesk shouts the numbers and page titles; a neutral neo-grotesk with tabular figures does all the reading.

### Hierarchy
- **Display** (800, 64px/56px, -0.04em, 75% width): live state counts heading board columns.
- **Headline** (800, 48px/48px, -0.03em, 80% width): page titles ("Engineering").
- **Title** (600, 20px/24px): section and dialog headings.
- **Body** (400, 13px/16px, tabular figures): issue titles, rows, form text.
- **Meta** (400, 12px/16px, graphite): identifiers, estimates, dates, assignee lines.
- **Label** (500, 11px/16px, 0.08em, uppercase): rail section headings and group labels. Nothing functional goes below 11px.

### Named Rules
**The Two Voices Rule.** Archivo only ever sets numbers and page titles. Everything a person reads in a sentence is Geist.

**The Aligned Figures Rule.** Identifiers, counts, estimates and dates use tabular figures and sit in their own column so they scan vertically.

## Layout

A fixed 232px ultramarine rail on the left, then a fluid work field. The field opens with a page title over a 1px ink rule, a thin filter bar, then the work area. The board divides the field into equal state columns separated by hairlines, each with 16px gutters; rows are separated by hairlines with 8px vertical padding. Page padding is 32px horizontally. All spacing is on the 8px grid, with 4px allowed for tight inner gaps. Below 1024px the tokens page stacks its two theme panels; app layouts must at least not break on mobile.

## Elevation & Depth

Flat. The page has no shadows; depth is expressed by tone (paper vs. raised white) and by rule weight (hairline vs. 4px ink rule). Floating layers (popovers, dialogs, menus) are the only raised surfaces and keep the shadcn overlay shadow.

### Named Rules
**The Flat Page Rule.** If it sits on the page, it has no shadow. Only things that float above the page may cast one.

## Shapes

Square. Corners are 2px at most (1px for small controls), set through the radius tokens, so every shadcn component inherits the same square language. Structure comes from straight rules: 1px hairlines between rows and cells, 4px ink rules under column headers and page titles. No pills, no rounded cards. Avatars are the one exception and stay circular.

## Components

### Buttons
- **Shape:** square (2px), 32px tall, 10px side padding.
- **Primary:** ink fill with paper text; one per view, for the main action ("New issue").
- **Hover / Focus:** fill lightens to 80% ink; focus shows the ultramarine 2px ring with 2px offset.
- **Outline / Secondary / Ghost:** outline on paper; secondary on light grey; ghost text-only for cancel actions.
- **Destructive:** ledger-red text on a 10% red wash; never a solid red block.

### Chips (tags)
- **Style:** labels are outlined or lightly filled tags with square corners and 11px text, never pills.

### Inputs / Fields
- **Style:** 1px control-edge border, paper fill, square, 32px tall.
- **Focus:** ultramarine ring.
- **Error:** ledger-red border plus a plain-language message under the field ("Use 2–5 capital letters.").

### Navigation
- **Rail:** ultramarine, white text at 13px/500. The active item inverts to a white block with ultramarine text. Section labels use the Label style at 65% white. Counts sit right-aligned in tabular figures.

### State Column Header (signature)
The board's departure-board moment: the state name in body semibold on the left, the live count in Display on the right, both over a 4px rule in the state's colour (ink for most, ultramarine for started, graphite for finished). When an issue moves, the count updates in place for every viewer.

### Priority Ramp (signature)
Three bars of rising height (4, 7, 10px, 3px wide, 1px apart). High fills three, medium two, low one; urgent fills all three in vermilion; no priority shows all three faint. It is the only priority mark in the product.

## Do's and Don'ts

### Do:
- **Do** put every edge on the 8px grid and separate rows with 1px hairlines.
- **Do** head every board column with its live count in Display.
- **Do** use tabular figures for ids, counts, estimates and dates.
- **Do** check every new text colour for 4.5:1 (3:1 for Display) in both themes.

### Don't:
- **Don't** use cards, rounded panels or shadows on the page to group content.
- **Don't** set vermilion as text, or use it for anything that is not urgent.
- **Don't** use Archivo for sentences, buttons or labels.
- **Don't** add coloured left borders thicker than 1px to rows or cards; mark selection with a fill instead.
