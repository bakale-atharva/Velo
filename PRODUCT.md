# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: software engineers on product teams who triage and move their work all day. They sit in a team's issue list or board for hours, mostly on the keyboard, creating, re-prioritising, assigning and moving issues between states, and jumping between issues fast.

Secondary (confirmed by the plan, not the primary design target): PMs and team leads who plan cycles and projects and read progress; org admins who manage members, teams, labels, roles and billing.

## Product Purpose

Velo is a B2B, multi-tenant issue tracker. A team should be able to run its daily work in it: issues on a board and in lists, projects, cycles, labels, filters, saved views, comments and an activity feed, full-text search, keyboard shortcuts. Success: a real team runs its day in Velo; one organization can never read or change another's data; paid tiers gate exactly what they say.

## Positioning

Speed and keyboard. Every change appears instantly and live for everyone (Convex real-time queries, optimistic updates), and everything an engineer does daily can be done from the keyboard: single-key shortcuts, `g`-prefixed navigation, and a Cmd/Ctrl+K command palette.

## Operating Context

- Workspace = Clerk organization; URLs are `/<orgSlug>/...`. Users switch orgs with the org switcher.
- Teams inside an org each have a key (`ENG`) and issue identifiers like `ENG-123`, their own workflow states (types: backlog, unstarted, started, completed, canceled), and optionally are private (Business plan).
- Issue fields: title, Markdown description, state, priority (0 none, 1 urgent, 2 high, 3 medium, 4 low), assignee, labels, estimate, due date, parent/sub-issues, project, cycle.
- Comments and descriptions are Markdown (textarea + rendered preview), no rich-text editor.
- Plans: Free (3 seats), Pro (AI assistant), Business (+ custom roles, audit log, private teams), Enterprise. Gated features show an upgrade prompt.
- Used on desktop browsers; mobile only needs to not break.

## Capabilities and Constraints

- Stack (existing): Next.js 16 with `cacheComponents: true`, React 19, Tailwind 4, Convex, Clerk (orgs + billing), pnpm. UI libraries chosen by the user: shadcn (base), Bklit UI and Kokonut UI via shadcn registries, Motion for animation.
- AI assistant (paid tiers) acts only as the calling member and shows every write for confirmation before it applies; suggestions never auto-apply.
- Non-goals: notifications/inbox, file attachments, public API/agents, SSO, marketing site beyond a pricing page, mobile layouts beyond "doesn't break".

## Brand Commitments

Name: Velo. No logo or other brand assets exist yet. The identity must be original, not a copy of any existing product's look (Linear included).

## Evidence on Hand

None. There are no customers, testimonials, metrics or screenshots; do not invent any.

## Product Principles

1. Fast beats complete: no spinner where an optimistic update or a skeleton will do; the common path takes one keystroke.
2. Keyboard first, mouse welcome: every daily action has a shortcut and a palette entry; nothing requires hover to discover.
3. Density with calm: show many issues at once without visual noise; hierarchy comes from type and spacing, not boxes.
4. Truthful state: what you see is what the server holds, live; errors say plainly what happened and what to do.
5. The assistant asks first: AI never changes data without the member confirming.

## Accessibility & Inclusion

- WCAG 2.2 AA is a hard requirement: contrast, visible focus, full keyboard operation, correct roles and labels.
- Light and dark themes are both first-class from the start.
