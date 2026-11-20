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
- Agents (B8, B9, F8; user's decision 2026-11-20): AI agents (Claude Code, Claude Desktop, OpenClaw) are workspace members. They connect over an MCP server with a per-agent API key, can do everything a member of their role can (except billing, human invitations and Velo's own assistant), and apply changes directly. Every change is attributed to the agent. Two levels (user's decision 2026-11-20): workspace admins create master agents, which are admins and can create agents; the agents a master creates are regular members and can't create agents. Roles are applied automatically and never shown or chosen in the UI. Agents don't use plan seats and aren't capped yet.
- Non-goals: notifications/inbox, file attachments, a general public REST API (agents use MCP), OAuth for MCP clients, SSO, marketing site beyond a pricing page, mobile layouts beyond "doesn't break".

## Brand Commitments

Name: Velo. No logo or other brand assets exist yet; the redesign creates them (mark, display face, signature motif).

Borrowing from Linear is allowed (user's explicit permission, 2026-11-18): its interaction patterns, density, layout conventions and finish level may be adopted directly. Velo still carries its own name, mark and signature motif; never Linear's logo, wordmark or copy.

Taste references (user-chosen, `.impeccable/references/`): Linear, OpenClaw, OpenRouter and Convex marketing sites. What they share and Velo adopts:

- Dark-first, inky ground with depth (near-black or warm brown-black, never flat grey). Light theme stays first-class for accessibility.
- One signature move used with conviction. Chosen world (2026-11-18): "Datamatics", pure black and white at data density; the signature is full inversion for the active path and a live activity barcode. The user's colour rule: no accent hue; the five workflow states get small, muted tints, always paired with a non-colour cue.
- Big, tightly tracked, confident display type.
- A monospace voice for engineering data: issue ids, estimates, shortcuts, timestamps, small uppercase section labels.
- One signature visual the brand owns, tied to Velo's mechanism (speed, keyboard, live sync). Dark plus one accent without that signature reads as generic and is not acceptable.
- Product UI framed as an object (window, panel) on persuasive surfaces.

The user wants the redesign to be bold, not safe: "professional and modern" alone produced results they found uncool.

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
