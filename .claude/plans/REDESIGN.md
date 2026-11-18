# Velo redesign: Datamatics

> **One branch for the whole redesign.** Every phase below is done on `design/redesign`. No phase gets its own branch, and nothing is merged to `main` until the whole redesign is finished and the user approves one PR. Commit per step inside that branch (tsc and lint before each commit, no test runs; commits end with the `Co-Authored-By` line).

## Why

The build (B1–B7, F1–F7) is done and works, but the "Soft Panels" look felt safe. The user wants Velo to look professional, modern and memorable, closer in spirit to the Linear, OpenClaw, OpenRouter and Convex sites (screenshots in `.impeccable/references/`). Borrowing from Linear is explicitly allowed.

## The chosen direction

Picked by the user from a direction round (2026-11-18): **Datamatics**, after Ryoji Ikeda's data-sublime installations. The contract lives in `.impeccable/surfaces/app.md`.

- **Ground and ink:** pure black ground, pure white ink. Greys are steps of the same signal: `#000 #0a0a0a #1a1a1a #333 #6b6b6b #a3a3a3 #fff`. Light theme is the exact inversion.
- **Colour:** no accent hue. The five workflow states get small, muted tints (user's choice), always paired with a pattern (the stage gauge). Destructive and urgent use one muted brick tone.
- **Type:** Geist for titles and UI text, set large and tight on page titles. Geist Mono carries all data: ids, numbers, dates, estimates, shortcuts, small uppercase section labels.
- **Shape:** hairline 1px rules, 2px corners at most, no shadows, no gradients, no floating cards.
- **Signature moves:**
  1. **Activity barcode:** each team's last 7 days drawn as hairline bars of created and completed issues.
  2. **Inversion is the active path:** the focused or selected row, the chosen tab segment and primary marks invert (white block, black text).
  3. **Signal flash:** a teammate's live change lands as a brief frame of inversion on that row.
- **Kept from the round:** a fixed-scale stage gauge on every row; identifiers as typeable coordinates; cycle capacity that visibly overflows; inversion reserved for the active path.

## Phases

Each phase ends with a check in the browser in both themes and a commit. The user nitpicks each phase before the next starts.

### Phase 0: Direction and docs (done)
- `PRODUCT.md` brand commitments updated: Linear borrowing allowed, the reference sites, the Datamatics choice and the colour rule.
- Direction contract written to `.impeccable/surfaces/app.md`; references saved to `.impeccable/references/`.

### Phase 1: Tokens and foundations (in progress)
- Rewrite `app/globals.css`: the black-and-white scale, muted state tints, 2px radius, no shadows, `inverted` / `data` / `signal-label` utilities, the `signal` keyframe, themed selection, caret, focus ring and scrollbars.
- Old Soft Panels utilities (`panel`, `iris-ring`, `chip-dark`, `profile-card`) are redefined in the new world so every screen changes at once; they are removed one by one as screens are rebuilt.
- Fonts: Figtree out, Geist and Geist Mono in (`app/layout.tsx`). Clerk appearance follows.
- Dark becomes the default theme (`components/providers.tsx`).

### Phase 2: Reference screen, the team issue list (in progress)
- `TeamPageHeader`: big tight title, inverted key block, mono meta, underlined tabs, signal slot.
- `ActivityBarcode` under the header.
- Issue rows as a table: id, stage gauge, priority, title and labels, due, estimate, assignee; focused row inverts.
- State groups as hairline-ruled sections with `NAME / 04` labels.
- View toggle, filter bar and New issue button in the new controls.
- Finish review against the contract, then generate `DESIGN.md` from this screen with `/impeccable document` (it replaces the Soft Panels `DESIGN.md`).

### Phase 3: Shell
- Sidebar: wordmark, search, nav, teams by key, member card as a hairline frame; active item inverts.
- Top bar, org switcher, theme toggle, command button.
- A new Velo mark that fits the world (designed, not a glyph).

### Phase 4: Shared components (shadcn base)
- Restyle `components/ui/*`: button, input, textarea, select, dialog, sheet, popover, dropdown, tooltip, tabs, badge, skeleton, sonner.
- Run `/impeccable extract` to pull repeated patterns (property rows, section labels, empty states, data cells) into shared components.

### Phase 5: Issue surfaces
- Board view (columns as hairline lanes, cards as framed rows, drag state).
- Issue detail (title, Markdown, properties as a data table, sub-issues, timeline, comments).
- Create-issue dialog, field pickers, filters, live signal flash on remote changes.

### Phase 6: Planning surfaces
- My issues, Projects list and detail, Cycles list and detail (with the overflowing capacity bar), Views, Search, command palette and shortcuts sheet.

### Phase 7: Settings and billing
- Settings layout and every settings page, Clerk `OrganizationProfile` and `PricingTable` appearance, upgrade prompts.

### Phase 8: Assistant and AI surfaces
- Assistant sheet, proposal cards, issue assist, report dialog, usage meter.

### Phase 9: Auth, onboarding and empty states
- Sign-in and sign-up, org creation, first-run and every empty, error and loading state. These may carry more of the world (larger barcode fields, inversion moments) because they are not dense working screens.

### Phase 10: Hardening and review
- `/impeccable audit` and `/impeccable critique` per surface; fix contrast, focus, keyboard, reduced motion and phone widths.
- Remove leftover Soft Panels tokens and utilities; delete the `/dev/tokens` page or rebuild it as the token reference.
- Refresh `DESIGN.md` from the finished app, run `graphify update .`, push `design/redesign` and open one PR.

## Rules for this redesign

- One branch, `design/redesign`, for everything above.
- Design work follows the impeccable skill; read `craft-floor.md` before UI edits.
- No backend changes unless a screen truly needs data it cannot get; ask first if so.
- WCAG 2.2 AA in both themes is a hard requirement.
- The user installs any new package; give the command and wait.
