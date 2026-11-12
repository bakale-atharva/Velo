# Velo — design and phased build plan

## Context

Velo is a B2B, multi-tenant issue tracker for product teams (same audience as Linear), built on the existing scaffold: Next.js 16 (`cacheComponents: true`), React 19, Tailwind 4, Convex, Clerk, pnpm. Today the repo has only Clerk sign-in/up pages, `proxy.ts` (`clerkMiddleware()`), `app/layout.tsx` (ClerkProvider + header), and `convex/auth.config.ts`. There is no schema, no organizations, no billing.

**Success:** a real team can run its daily work in Velo; one organization can never read or change another's data; paid tiers gate exactly what they say.

This file is also the design doc. Phase 0 commits a copy to `docs/superpowers/specs/2026-11-12-velo-design.md`.

---

## RULES FOR WHOEVER EXECUTES THIS PLAN (read before every phase)

1. **Never install anything yourself.** Do not run `pnpm i`, `pnpm install`, `pnpm add`, `pnpm dlx shadcn ... add`, `npx ... install`, `graphify install`, or any command that adds a package, component or skill. Print the exact command in a `bash` code block, say "run this and tell me when it's done", and stop. After the user confirms, check `package.json` (or the expected file) shows the result before continuing.
2. **One phase = one branch = one PR.** Start: `git checkout main && git pull origin main && git checkout -b <branch>`. Never commit to `main` after Phase 0. Never merge a PR; the user merges after approving.
3. **One bullet = one commit.** Each numbered item under a phase is exactly one commit, in that order, with the commit message given. End every commit message with the line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
4. **Before each commit run:** `pnpm exec tsc --noEmit`, `pnpm lint`, and (from B1 onward) `pnpm test`. Do not commit if any fails; fix first. If something cannot be fixed, stop and report the exact error.
5. **Before writing any Convex code**, read `convex/_generated/ai/guidelines.md` in full. Key rules from it: every function has argument validators; internal-only functions use `internalQuery/internalMutation/internalAction`; no unbounded `.collect()` (use `.take(n)` or `.paginate`); use `.withIndex`, never `.filter` for scale; index names list every field (`by_orgId_and_teamId`); no `Date.now()` inside queries; `ctx.vectorSearch` only in actions; `undefined` is not a value, use `null`.
6. **Use the installed skills:** Convex work → `convex`, `convex-expert`, `convex-test`, `convex-crons`, `convex-agent`, `convex-authz`, `convex-reviewer`. Clerk work → `clerk-orgs` (via `clerk`), `clerk-billing`, `clerk-webhooks`, `clerk-nextjs-patterns`, `clerk-cli`. Frontend → `impeccable`. Library docs → Context7 (`/clerk/clerk-docs`).
7. **Tenant rule (never break):** every public Convex function starts by calling `requireMember(ctx)` (or a stricter helper) and uses the returned `orgId` for every read and write. Never accept `orgId` as a function argument from the client. Every document fetched by id must be checked: `if (doc.orgId !== orgId) throw new ConvexError("NOT_FOUND")`.
8. **No guessing.** If a Clerk or Convex API in this plan does not behave as written, look it up (Context7 or the skill), and if still unclear stop and ask the user. Do not invent a workaround silently.
9. **Dashboard / account changes** (Clerk plans, webhooks, enabling features, Convex env vars holding secrets) are done by the user unless they say otherwise. Give exact click paths or commands and wait.
10. **End of every phase, in this order:** run `graphify update .`; update the phase's Linear issues to Done; `git push -u origin <branch>`; `gh pr create` with a body listing the commits, how it was verified, and ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`; post the PR link; stop and wait for approval.
11. **Next.js 16 with `cacheComponents: true`:** any Server Component that calls `auth()` must be an async child inside `<Suspense>`, or sit next to a `loading.tsx` if it redirects. Otherwise `next build` fails.
12. Do not build anything in the Non-goals list.

---

## Decided with the user

- **Tenancy:** Clerk Organization = workspace. Members are invited through Clerk. Everyone is a signed-in person.
- **Core features:** issues with Kanban board + list views; projects; cycles; labels, filters, saved views; comments + activity feed; full-text search; keyboard shortcuts.
- **UI libraries:** shadcn (base), Bklit UI and Kokonut UI via shadcn registries, Motion for animation. Impeccable setup runs first in the frontend.
- **AI (paid tiers only, free OpenRouter models):** chat assistant with workspace context; actions from natural language; issue summaries and label/priority suggestions; reports; semantic duplicate detection with a free embedding model (feature dropped if no usable free model).
- **AI behaviour:** acts only as the calling member; every write is shown and confirmed before it applies; suggestions never auto-apply; reports on demand; per-org daily cap; fallback model; clear rate-limit message.
- **Tiers (Clerk Billing, Organization Plans):**

| Plan | Slug | Monthly / yearly-equivalent | Seats | Features |
|---|---|---|---|---|
| Free | `free_org` (auto-created by Clerk) | $0 | 3 | none |
| Pro | `pro` | $199 / $169 base, +$12 / $10 per seat over 20 | 20 included | `ai_assistant` |
| Business | `business` | $18 / $16 per seat | per seat, unlimited | `ai_assistant`, `custom_roles`, `audit_log`, `private_teams` |
| Enterprise | `enterprise` | $990 / $900 flat | unlimited | same as Business |

- **Auth approach:** the Clerk token decides identity, active org and role on each request; webhook-synced Convex tables supply members and plan.
- **Workflow:** backend phases first, then frontend; a branch + PR per phase; merge only after approval; Phase 0 is the only work on `main`.

## Non-goals

External agents (no API keys, agent members, public API, MCP server). Notifications/inbox. Scheduled report delivery. SSO/verified domains. Marketing site beyond a pricing page. File attachments. Mobile layouts beyond "doesn't break".

## Approaches considered (auth/entitlements)

- **A. Token only** — rejected: no member data in Convex; background jobs can't know the plan.
- **B. Synced tables only** — rejected alone: new members and upgrades wait on a webhook.
- **C. Token + synced tables** — chosen.

## My calls (not user decisions; correct any)

- Teams sit under each org with their own key (`ENG-123`), workflow states and members.
- **Plan and features on the backend are always read from the synced `subscriptions` table + a constant map**, never from the token (works in background jobs, updates live). The frontend may use Clerk `has({ feature })` only to show/hide UI.
- AI daily request caps per org: Pro 100, Business 500, Enterprise 2000.
- Custom roles are Velo's own (a Convex table of roles with fixed permission strings), not Clerk custom roles. Clerk `admin` always has every permission.
- On downgrade: existing private teams stay private, no new ones can be made; AI turns off; custom roles stop applying (everyone falls back to member defaults).
- Issue descriptions and comments are Markdown text (textarea + rendered preview), no rich-text editor.
- Board order uses a rank string per issue (`fractional-indexing`).
- Branch names `backend/<n>-<slug>`, `frontend/<n>-<slug>`.

## Known constraints and risks

- Clerk's paid **B2B Authentication add-on** is needed for any plan above 20 seats or unlimited (Pro overage, Business, Enterprise).
- The installed `clerk-billing` skill says org plans are fixed-price with a seat cap; the current Clerk docs describe a base fee + included seats + per-seat fee. **Trust the docs, verify in the dashboard in B2.** If per-seat fees or yearly per-seat pricing are not available, stop and tell the user.
- A plan's seat limit cannot be changed after creation; get it right first time.
- Clerk Billing APIs are experimental: pin `@clerk/nextjs` to an exact version.
- Free OpenRouter models are rate-limited and weaker at multi-step tool use. Some free embedding models keep inputs for training; prefer one that does not, otherwise tell the user before using it.

---

## Shared reference (used by all phases)

**Tenant key:** the Clerk organization id string (`org_...`) stored in a field named `orgId` on every tenant table. Users are referenced by Clerk user id string (`user_...`) in fields ending `Id` such as `assigneeId`, `creatorId`, `actorId`.

**Errors:** throw `new ConvexError("<CODE>")` with codes `UNAUTHENTICATED`, `NO_ACTIVE_ORG`, `FORBIDDEN`, `NOT_FOUND`, `FEATURE_NOT_IN_PLAN`, `LIMIT_REACHED`, `INVALID_INPUT`.

**Constants (`convex/lib/plans.ts`):**
```ts
export const PLAN_FEATURES = {
  free_org: [],
  pro: ["ai_assistant"],
  business: ["ai_assistant", "custom_roles", "audit_log", "private_teams"],
  enterprise: ["ai_assistant", "custom_roles", "audit_log", "private_teams"],
} as const;
export const AI_DAILY_LIMIT = { free_org: 0, pro: 100, business: 500, enterprise: 2000 } as const;
```

**Permissions (`convex/lib/permissions.ts`):** `issues.delete`, `teams.manage`, `labels.manage`, `projects.manage`, `cycles.manage`, `views.share`. Member defaults: `projects.manage`, `cycles.manage`, `views.share`. Admin: all.

**Priority:** number 0 none, 1 urgent, 2 high, 3 medium, 4 low. **State types:** `backlog | unstarted | started | completed | canceled`.

---

## Phase 0 — setup (on `main`, no PR)

1. **Check origin.** `git fetch origin`, `git status -sb`. If local `main` is ahead, `git push origin main`. If behind, `git pull --ff-only`. Report the result.
2. **Graphify.** Give the user `graphify install --platform claude` to run. After they confirm, run `graphify update .` and confirm `graphify-out/graph.json` exists. Check `git status`; if `graphify-out/` should not be tracked, ask the user before adding it to `.gitignore`.
3. **Commit: `docs: add Velo design and agent rules`.** Copy this plan to `docs/superpowers/specs/2026-11-12-velo-design.md`. Append to `CLAUDE.md`: the "Rules for whoever executes this plan" section verbatim, plus "Before exploring files, run `graphify query \"<question>\"`; after changing code run `graphify update .`". Push to `main`.
4. **Save the install rule to memory** (feedback type): user runs all installs; agent only gives the command.
5. **Linear.** Using the Linear tools, in team `Dev` (`ATH`): create project **Velo** (summary, repo link `https://github.com/bakale-atharva/Velo`, the workflow rules). Create one milestone per phase (B1–B7, F1–F7). Create one parent issue per phase titled e.g. `B1 Tenancy foundation`, and one child issue per numbered commit under it, titled with the commit message. First check `list_issues` so nothing is duplicated.
6. **Prerequisites checklist for the user** (print it, wait for confirmation):
   - Clerk Dashboard → Organizations: enabled, "Membership required".
   - Clerk Dashboard → Billing → Settings: enabled for organizations.
   - B2B Authentication add-on enabled.
   - Clerk Dashboard → Integrations → Convex activated (session token gets `aud: "convex"`).
   - OpenRouter API key created (needed in B7).

---

## Backend

### B1 Tenancy foundation — branch `backend/1-tenancy`

User installs first: `pnpm add -D vitest convex-test @edge-runtime/vm` and `pnpm add -E @clerk/backend`.

1. **`chore: add vitest for convex tests`** — add `vitest.config.ts` (`test.environment: "edge-runtime"`, `server.deps.inline: ["convex-test"]`); add script `"test": "vitest run"` to `package.json`; add `convex/smoke.test.ts` that asserts `1 + 1 === 2` so the runner is proven.
2. **`feat(convex): add tenancy schema`** — create `convex/schema.ts` with:
   - `users`: `clerkId`, `email`, `name`, `imageUrl` (string or null); index `by_clerkId`.
   - `organizations`: `clerkOrgId`, `name`, `slug`, `imageUrl`; indexes `by_clerkOrgId`, `by_slug`.
   - `memberships`: `orgId`, `userId`, `role` (string, e.g. `"admin"`, `"member"`), `customRoleId` (optional id of `customRoles`, table added in B6 — leave the field out until then); indexes `by_orgId_and_userId`, `by_userId`.
   - `webhookEvents`: `svixId`; index `by_svixId`.
3. **`feat(convex): add auth helpers`** — create `convex/lib/auth.ts`:
   - `getAuth(ctx)`: calls `ctx.auth.getUserIdentity()`; throws `UNAUTHENTICATED` if null. Returns `{ userId: identity.subject, orgId, role }`.
   - Reading the org from the token: Clerk's v2 token has claim `o` = `{ id, slg, rol }`. **First write a temporary query that returns the raw identity, call it from the Convex dashboard while signed in, and see exactly how `o` appears** (nested object vs. dotted keys like `identity["o.id"]`). Write `readOrgClaims(identity)` to match what you saw, then delete the temporary query.
   - `requireMember(ctx)`: `getAuth`, throws `NO_ACTIVE_ORG` if no org id; returns `{ userId, orgId, role }`.
   - `requireAdmin(ctx)`: `requireMember` then throws `FORBIDDEN` unless role is `"admin"`.
   - `convex/lib/errors.ts` with the error codes.
4. **`feat(convex): sync Clerk users, orgs and memberships by webhook`** —
   - `convex/http.ts`: `httpRouter`, route `POST /clerk-webhook`, `httpAction` that verifies the request with `verifyWebhook(req, { signingSecret })` from `@clerk/backend/webhooks` (secret from Convex env `CLERK_WEBHOOK_SIGNING_SECRET`). On failure return 400. If `verifyWebhook` does not run in the Convex runtime, stop and ask the user to install `svix` and use `new Webhook(secret).verify(body, headers)` instead.
   - Read header `svix-id`; call `internal.clerkSync.handleEvent` with `{ svixId, type, data }`.
   - `convex/clerkSync.ts` (`internalMutation`s): skip if `svixId` already in `webhookEvents`, else insert it. Handle `user.created/updated` (upsert `users`), `user.deleted` (delete user + memberships), `organization.created/updated` (upsert), `organization.deleted` (delete org + memberships), `organizationMembership.created/updated` (upsert; strip the `org:` prefix from role), `organizationMembership.deleted`.
   - Tell the user: add endpoint `<NEXT_PUBLIC_CONVEX_SITE_URL>/clerk-webhook` in Clerk Dashboard → Webhooks, subscribe to those 9 events, then run `npx convex env set CLERK_WEBHOOK_SIGNING_SECRET <secret>`.
5. **`feat(convex): add org and member queries`** — `convex/organizations.ts`: `current` (the active org doc), `convex/members.ts`: `list` (members of active org joined with `users`, `.take(500)`), `me`. Both use `requireMember`.
6. **`test(convex): tenant isolation for tenancy functions`** — `convex/members.test.ts` using `convexTest(schema, import.meta.glob("./**/*.ts"))` and `t.withIdentity({ subject: "user_a", ...org claims })`: (a) unauthenticated call throws `UNAUTHENTICATED`; (b) no org throws `NO_ACTIVE_ORG`; (c) user in org A never sees org B members; (d) replayed `svixId` is ignored; (e) membership deleted → removed from list.

**Done when:** inviting a user in Clerk makes them appear in `members.list` within seconds; all tests pass.

### B2 Billing and entitlements — branch `backend/2-billing`

1. **`chore: pin clerk package versions`** — change `@clerk/nextjs` in `package.json` to the exact installed version (no `^`). Give the user `pnpm install` to refresh the lockfile.
2. **`docs: record Clerk plan configuration`** — with the user (they click, or approve `clerk config patch` via the `clerk-cli` skill): create Organization Plans `pro`, `business`, `enterprise` exactly as in the tiers table; set `free_org` seat limit 3; attach features as in `PLAN_FEATURES`. Write what was actually created (including anything Clerk did not support) to `docs/billing-config.md`. **If per-seat fee, included seats, or yearly per-seat pricing is unavailable, stop and report before continuing.**
3. **`feat(convex): add subscriptions table and billing webhook sync`** — schema `subscriptions`: `orgId`, `clerkSubscriptionId`, `planSlug`, `status`, `updatedAt`; index `by_orgId`. In `clerkSync.ts` handle `subscription.created`, `subscription.updated`, `subscription.active`, `subscription.pastDue`: org id is `data.payer.organization_id` (ignore events without it); plan slug is the `plan.slug` of the item in `data.items` whose status is `active` (fallback `free_org`). Also handle `subscriptionItem.canceled` / `subscriptionItem.ended` by re-reading nothing and simply waiting for the following `subscription.updated`. Tell the user to add these events to the webhook endpoint.
4. **`feat(convex): add entitlement helpers`** — `convex/lib/plans.ts` (constants above) and `convex/lib/entitlements.ts`: `getPlan(ctx, orgId)` → plan slug (`free_org` if no row or status not `active`); `hasFeature(ctx, orgId, feature)`; `requireFeature(ctx, orgId, feature)` throws `FEATURE_NOT_IN_PLAN`. `convex/billing.ts`: public query `currentPlan` returning `{ planSlug, features, aiDailyLimit }`.
5. **`test(convex): entitlements and subscription sync`** — no subscription → `free_org`; pro → `ai_assistant` only; business → all four; `past_due` → treated as `free_org`; org A's plan never leaks to org B.

**Done when:** subscribing a test org to Pro on the Clerk dev gateway flips `billing.currentPlan` to `pro` without a reload; inviting a 4th member on Free is blocked by Clerk.

### B3 Teams and issues — branch `backend/3-issues`

User installs first: `pnpm add fractional-indexing`.

1. **`feat(convex): add teams, workflow states and labels schema`** —
   - `teams`: `orgId`, `name`, `key` (2–5 uppercase letters), `isPrivate`, `nextIssueNumber`, `archivedAt` (number or null); indexes `by_orgId`, `by_orgId_and_key`.
   - `teamMembers`: `orgId`, `teamId`, `userId`; indexes `by_teamId_and_userId`, `by_orgId_and_userId`.
   - `workflowStates`: `orgId`, `teamId`, `name`, `type`, `color`, `position`; index `by_teamId_and_position`.
   - `labels`: `orgId`, `name`, `color`; index `by_orgId_and_name`.
2. **`feat(convex): add team functions`** — `convex/teams.ts`: `create` (admin or `teams.manage`; validates key format and uniqueness in org; inserts 5 default states Backlog/Todo/In Progress/Done/Canceled; adds creator as team member), `list`, `get` (by key), `update`, `archive`, `addMember`, `removeMember`. `convex/lib/teamAccess.ts`: `requireTeamAccess(ctx, teamId)` → loads team, checks `orgId`, and if `isPrivate` requires a `teamMembers` row (admins included only if they are members). `isPrivate: true` requires feature `private_teams`.
3. **`feat(convex): add workflow state and label functions`** — `convex/workflowStates.ts`: `list`, `create`, `update`, `reorder`, `remove` (refuse if any issue uses it). `convex/labels.ts`: `list`, `create`, `update`, `remove`.
4. **`feat(convex): add issues schema`** — `issues`: `orgId`, `teamId`, `number`, `identifier`, `title`, `description`, `stateId`, `stateType`, `priority`, `assigneeId` (string or null), `creatorId`, `labelIds` (array of label ids), `estimate` (number or null), `parentId` (issue id or null), `projectId`/`cycleId` (optional ids, tables come in B4 — add the fields in B4), `rank`, `dueDate`, `completedAt`, `archivedAt`, `searchText`. Indexes: `by_teamId_and_number`, `by_teamId_and_stateId_and_rank`, `by_orgId_and_assigneeId`, `by_parentId`, `by_orgId_and_identifier`.
5. **`feat(convex): add issue create, read and update`** — `convex/issues.ts`:
   - `create`: `requireTeamAccess`; read team, use `nextIssueNumber`, patch team `+1` in the same mutation; `identifier = key + "-" + number`; default state = first `unstarted` (or `backlog`) state; `rank` = `generateKeyBetween(lastRankInState, null)`; `searchText = title + "\n" + description`; write an activity (item 7).
   - `get` (by identifier), `listByTeam` (paginated with `paginationOptsValidator`, by state), `listForBoard` (per state, `.take(200)`), `listSubIssues`.
   - `update`: one mutation taking optional fields (`title`, `description`, `stateId`, `priority`, `assigneeId`, `labelIds`, `estimate`, `dueDate`, `parentId`); validates every referenced id belongs to the same org/team; when state type becomes `completed` set `completedAt`; recompute `searchText`; one activity per changed field.
   - `move`: args `issueId`, `stateId`, `beforeRank`, `afterRank` → new rank via `generateKeyBetween`.
   - `archive`, `remove` (`issues.delete` permission).
6. **`feat(convex): add comments`** — `comments`: `orgId`, `issueId`, `authorId`, `body`, `editedAt`; index `by_issueId`. `convex/comments.ts`: `list` (paginated), `create`, `update` (author only), `remove` (author or admin).
7. **`feat(convex): add activity log`** — `activities`: `orgId`, `issueId`, `actorId`, `viaAssistant` (boolean), `type` (`created | title | description | state | priority | assignee | labels | estimate | dueDate | parent | project | cycle | comment | archived`), `from`, `to` (string or null); index `by_issueId`. `convex/lib/activity.ts`: `logActivity(ctx, {...})`, called from every issue and comment mutation. `convex/activities.ts`: `listForIssue` (paginated, newest first).
8. **`test(convex): issues, comments, activity and isolation`** — numbering is sequential per team; two orgs can both have team key `ENG`; cross-org `get`/`update`/`move`/`comment` all throw `NOT_FOUND`; non-member of a private team gets `NOT_FOUND`; private team creation on Free throws `FEATURE_NOT_IN_PLAN`; update writes one activity per changed field; a state from another team is rejected.

**Done when:** tests pass and an issue can be created, moved and commented on from the Convex dashboard.

### B4 Projects and cycles — branch `backend/4-projects-cycles`

1. **`feat(convex): add projects`** — `projects`: `orgId`, `name`, `description`, `status` (`planned | started | paused | completed | canceled`), `leadId`, `teamIds`, `startDate`, `targetDate`, `issueCount`, `completedIssueCount`; index `by_orgId`. `convex/projects.ts`: `create/update/remove` (`projects.manage`), `list`, `get`, `listIssues` (paginated). Add `projectId` to `issues` + index `by_projectId`.
2. **`feat(convex): keep project progress counts in issue mutations`** — in `issues.create/update/archive/remove`, adjust the project's `issueCount` and `completedIssueCount` in the same mutation whenever `projectId` or state type changes. Extract to `convex/lib/projectCounts.ts`.
3. **`feat(convex): add cycles`** — `cycles`: `orgId`, `teamId`, `number`, `name`, `startsAt`, `endsAt`, `status` (`upcoming | active | completed`); indexes `by_teamId_and_startsAt`, `by_status_and_endsAt`. `convex/cycles.ts`: `create` (`cycles.manage`; rejects overlap with another cycle of the team), `update`, `list`, `get`, `listIssues`. Add `cycleId` to `issues` + index `by_cycleId`.
4. **`feat(convex): roll over cycles on a schedule`** — `convex/crons.ts`: `crons.interval("cycle rollover", { minutes: 15 }, internal.cycles.rollover, {})`. `rollover` (internalMutation): activate `upcoming` cycles whose `startsAt <= now`; for `active` cycles with `endsAt <= now` set `completed` and move every issue whose state type is not `completed`/`canceled` to that team's next upcoming cycle (or clear `cycleId` if none), logging a `cycle` activity with `actorId: "system"`. Process at most 100 issues per run and reschedule itself with `ctx.scheduler.runAfter(0, ...)` if more remain.
5. **`test(convex): projects, cycles and rollover`** — counts stay right across create/complete/move/remove; overlap rejected; rollover moves only unfinished issues; cross-org access refused.

### B5 Views and search — branch `backend/5-views-search`

1. **`feat(convex): add issue filter query`** — `convex/issueFilters.ts`: validator `issueFilter` = `{ teamId?, stateTypes?, stateIds?, assigneeIds?, labelIds?, priorities?, projectId?, cycleId?, creatorId? }`. Query `issues.listFiltered({ filter, paginationOpts })`: choose the most selective index in this order — `cycleId`, `projectId`, `assigneeId` (single), `teamId` — then apply the remaining conditions in code on the returned page. Private-team issues are removed unless the caller is a team member. Add index `by_orgId_and_teamId` for the team case.
2. **`feat(convex): add my issues`** — `issues.listMine` (assigned to caller, open states first) using `by_orgId_and_assigneeId`.
3. **`feat(convex): add saved views`** — `savedViews`: `orgId`, `ownerId`, `name`, `isShared`, `filter` (the validator above), `layout` (`list | board`), `groupBy` (`state | assignee | priority | project | none`); indexes `by_orgId_and_ownerId`, `by_orgId_and_isShared`. `convex/savedViews.ts`: `list` (mine + shared), `get`, `create`, `update`, `remove` (owner or admin); `isShared: true` requires `views.share`.
4. **`feat(convex): add full-text issue search`** — add `.searchIndex("search_text", { searchField: "searchText", filterFields: ["orgId", "teamId"] })` to `issues`. `convex/search.ts`: `issues({ query, teamId? })` → `.withSearchIndex(...).take(25)`, then drop private-team issues the caller cannot see. Empty query returns `[]`.
5. **`test(convex): filters, views and search`** — each filter field narrows correctly; search never returns another org's issue; private views not visible to others; shared views visible to the org.

### B6 Business controls — branch `backend/6-business-controls`

1. **`feat(convex): add custom roles`** — `customRoles`: `orgId`, `name`, `permissions` (array of the fixed strings); index `by_orgId`. Add optional `customRoleId` to `memberships`. `convex/roles.ts`: `list`, `create`, `update`, `remove`, `assign` — all `requireAdmin` + `requireFeature(custom_roles)`.
2. **`feat(convex): enforce permissions everywhere`** — `convex/lib/permissions.ts`: `requirePermission(ctx, permission)`: admin → allow; else if org has `custom_roles` and the member has a `customRoleId` → use that role's permissions; else member defaults. Replace the ad-hoc checks added in B3–B5 with this helper.
3. **`feat(convex): add audit log`** — `auditLogs`: `orgId`, `actorId`, `action`, `targetType`, `targetId`, `metadata` (record of strings); index `by_orgId`. `convex/lib/audit.ts`: `logAudit(ctx, ...)` — always writes (so history exists if the org upgrades). Call it from: team create/update/archive/member changes, role changes, label/state deletes, issue delete, project delete, saved-view sharing. `convex/auditLogs.ts`: `list` (paginated) — `requireAdmin` + `requireFeature(audit_log)`.
4. **`test(convex): roles, permissions, audit log`** — member without permission is refused; custom role grants it; on Free the custom role is ignored; audit list refused without the feature and for non-admins; cross-org refused.
5. **`chore(convex): authz review fixes`** — run the `convex-authz` and `convex-reviewer` skills over all of `convex/`; fix every finding; if none, skip this commit and say so in the PR.

### B7 AI — branch `backend/7-ai`

User installs first: `pnpm add @convex-dev/agent @convex-dev/rate-limiter ai @openrouter/ai-sdk-provider zod`. User runs: `npx convex env set OPENROUTER_API_KEY <key>`.

1. **`docs: choose OpenRouter models`** — call `GET https://openrouter.ai/api/v1/models` and `GET https://openrouter.ai/api/v1/embeddings/models`; pick (a) a primary free chat model that supports tool calling, (b) a second free chat model as fallback, (c) a free embedding model, noting its exact vector length and whether it retains inputs for training. Write choices and reasons to `docs/ai-models.md`. If the only free embedding models retain inputs, ask the user before going on; if none exist, skip commits 8–9.
2. **`feat(convex): mount agent and rate limiter components`** — `convex/convex.config.ts` with `defineApp()`, `app.use(agent)`, `app.use(rateLimiter)`. `convex/ai/models.ts`: OpenRouter provider built from the env key; exports `chatModel`, `fallbackChatModel`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`.
3. **`feat(convex): add AI access guard and daily limits`** — `convex/ai/guard.ts`: `requireAi(ctx)` = `requireMember` + `requireFeature(ai_assistant)` + rate-limiter check keyed by `orgId` with the plan's `AI_DAILY_LIMIT` per 24h (throws `LIMIT_REACHED`). Public query `ai.usage` → `{ used, limit }`.
4. **`feat(convex): add assistant threads and chat`** — `aiThreads`: `orgId`, `userId`, `agentThreadId`, `title`; index `by_orgId_and_userId`. `convex/ai/chat.ts`: `createThread`, `listThreads`, `listMessages` (only the caller's own threads), and action `sendMessage({ threadId, text })` which runs the agent; on a rate-limit or provider error retry once with `fallbackChatModel`, then return a typed `{ ok: false, reason: "MODEL_UNAVAILABLE" }`.
5. **`feat(convex): add read-only assistant tools`** — `convex/ai/tools.ts`: tools `searchIssues`, `getIssue`, `listTeams`, `listMembers`, `listProjects`, `listCycles`, `listLabels`. Each tool calls an **internal query that takes `orgId` and `userId` captured from the authenticated action**, never from model output, and applies the same private-team rule as B5.
6. **`feat(convex): add proposed actions with confirmation`** — `aiProposals`: `orgId`, `userId`, `threadId`, `actions` (array of a `v.union` of `createIssue`, `updateIssue`, `assignIssue`, `setPriority`, `addComment`), `status` (`pending | applied | rejected`); index `by_threadId`. Write tools (`proposeCreateIssue`, etc.) **only insert a proposal**. Public mutations `ai.applyProposal` / `ai.rejectProposal`: caller must be the proposal's user; apply runs the same internal logic as `issues.create/update` with `viaAssistant: true` on activities; a proposal can be applied once.
7. **`feat(convex): add issue summaries, suggestions and reports`** — `aiSuggestions`: `orgId`, `issueId`, `kind` (`summary | labels | priority | duplicate`), `payload`, `status` (`pending | accepted | dismissed`); index `by_issueId`. Actions: `ai.summarizeIssue`, `ai.suggestForIssue` (scheduled with `ctx.scheduler.runAfter(0, ...)` from `issues.create` only when the org has `ai_assistant`; picks only from existing labels), `ai.generateReport({ kind: "cycle" | "standup" | "project", id })` returning Markdown. Mutations `ai.acceptSuggestion` / `ai.dismissSuggestion`.
8. **`feat(convex): add issue embeddings`** — `issueEmbeddings`: `orgId`, `issueId`, `embedding` (`v.array(v.float64())`), `.vectorIndex("by_embedding", { vectorField: "embedding", dimensions: EMBEDDING_DIMENSIONS, filterFields: ["orgId"] })`, index `by_issueId`. Internal action `ai.embedIssue` (POST `https://openrouter.ai/api/v1/embeddings`), scheduled on issue create and on title/description change for orgs with `ai_assistant`.
9. **`feat(convex): add duplicate detection`** — action `ai.findDuplicates({ issueId })`: `ctx.vectorSearch` filtered by `orgId`, limit 6, drop the issue itself and scores below 0.8, hydrate through one internal query that also applies the private-team rule, store as a `duplicate` suggestion.
10. **`test(convex): AI gating, proposals and isolation`** — (mock model calls; no network) Free org → `FEATURE_NOT_IN_PLAN`; over limit → `LIMIT_REACHED`; a proposal cannot be applied by another user or twice; applying writes activities with `viaAssistant: true`; tools never return another org's issues or private-team issues.

---

## Frontend

For every frontend phase: client components that use Convex hooks need `"use client"`; data loads with `useQuery`/`usePaginatedQuery` from `convex/react`; show a skeleton while a query is `undefined`; show an empty state when a list is empty; map `ConvexError` codes to plain messages; `FEATURE_NOT_IN_PLAN` shows an upgrade prompt linking to settings → billing.

### F1 Design setup — branch `frontend/1-design-setup`

1. **`docs: add design guidelines`** — run the `impeccable` skill's setup flow with the user (product: fast, keyboard-first issue tracker for product teams; original identity, not a copy of any existing product's look). Commit the files it produces (`DESIGN.md` etc.).
2. **`chore: initialise shadcn`** — user runs `pnpm dlx shadcn@latest init`. Commit `components.json`, `lib/utils.ts`, and the token changes in `app/globals.css`, adjusted to match `DESIGN.md`.
3. **`chore: add Bklit and Kokonut registries`** — add `"@bklit": "https://ui.bklit.com/r/{name}.json"` under `registries` in `components.json`; look up Kokonut UI's registry URL in its docs and add it the same way.
4. **`chore: add base components`** — give the user one `pnpm dlx shadcn@latest add ...` command for: button, input, textarea, dialog, dropdown-menu, popover, command, tooltip, select, checkbox, avatar, badge, separator, skeleton, sonner, tabs, sheet, scroll-area, sidebar. Commit the generated files unchanged.
5. **`chore: add motion`** — user runs `pnpm add motion`. Add `components/motion/` with two small wrappers (fade-in, list-item layout animation) following `DESIGN.md` timing.
6. **`feat: add design tokens page`** — `app/dev/tokens/page.tsx` showing colors, type scale, buttons and inputs in light and dark, so the system can be reviewed in the PR.

### F2 App shell — branch `frontend/2-app-shell`

1. **`feat: connect Convex to Clerk on the client`** — `components/providers.tsx` (`"use client"`): `ConvexProviderWithClerk` from `convex/react-clerk` with `useAuth` from `@clerk/nextjs`; wrap children in `app/layout.tsx` inside `ClerkProvider`. Remove the scaffold header from the layout.
2. **`feat: activate organization from the URL`** — in `proxy.ts` pass `organizationSyncOptions: { organizationPatterns: ["/:slug", "/:slug/(.*)"] }` with public routes `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/onboarding(.*)`, `/dev(.*)` excluded, and call `auth.protect()` for everything else.
3. **`feat: add landing and onboarding`** — `app/page.tsx`: signed out → product name, one-line pitch, sign-in/sign-up buttons; signed in → redirect to `/<orgSlug>/my-issues`, or `/onboarding` if no org. `app/onboarding/page.tsx`: Clerk `<OrganizationList hidePersonal afterCreateOrganizationUrl="/:slug/my-issues" afterSelectOrganizationUrl="/:slug/my-issues" />`.
4. **`feat: add workspace layout and sidebar`** — `app/[orgSlug]/layout.tsx`: if the URL slug does not match the active org → `notFound()`. Sidebar: `<OrganizationSwitcher hidePersonal>`, links (My issues, Projects, Views, Search), team list from `api.teams.list` each with Issues and Cycles links, Settings, `<UserButton>`.
5. **`feat: add team creation`** — "New team" dialog (name, key auto-suggested from name, private toggle disabled with an upgrade hint when `private_teams` is missing) → `api.teams.create`.
6. **`feat: add shared states`** — `components/states/` (page skeleton, empty state, error boundary, upgrade prompt) and `lib/errors.ts` (ConvexError code → message).

### F3 Issues — branch `frontend/3-issues`

User installs first: `pnpm add @dnd-kit/core @dnd-kit/sortable react-markdown`.

1. **`feat: add issue list view`** — `app/[orgSlug]/team/[teamKey]/issues/page.tsx`: grouped by state, row shows identifier, title, priority icon, labels, assignee avatar; `usePaginatedQuery(api.issues.listByTeam)` with "load more".
2. **`feat: add issue board view`** — same route with `?view=board`: one column per state from `api.issues.listForBoard`; dnd-kit drag within and across columns calls `api.issues.move` with an optimistic update; list/board toggle remembered in `localStorage`.
3. **`feat: add create issue dialog`** — title, description, state, priority, assignee, labels, estimate; opens from a button; stays open with "create another" checked.
4. **`feat: add issue detail page`** — `app/[orgSlug]/issue/[identifier]/page.tsx`: editable title and Markdown description (edit/preview), right-hand properties panel (state, priority, assignee, labels, estimate, due date, project, cycle, parent), sub-issue list with add.
5. **`feat: add comments and activity feed`** — below the description: one merged timeline of `api.activities.listForIssue` and `api.comments.list` sorted by time; comment composer; edit/delete own comment; activities made through the assistant show an "via assistant" tag.
6. **`feat: add my issues page`** — `app/[orgSlug]/my-issues/page.tsx` from `api.issues.listMine`.

### F4 Projects and cycles — branch `frontend/4-projects-cycles`

1. **`feat: add projects list and create`** — `app/[orgSlug]/projects/page.tsx`: table with status, lead, target date, progress bar (`completedIssueCount / issueCount`); create/edit dialog.
2. **`feat: add project detail`** — `projects/[projectId]/page.tsx`: header, progress, issue list reusing the F3 list component.
3. **`feat: add cycles list and create`** — `team/[teamKey]/cycles/page.tsx`: active, upcoming, completed sections; create dialog with date range; overlap error shown inline.
4. **`feat: add cycle detail`** — `team/[teamKey]/cycles/[number]/page.tsx`: dates, scope/completed counts, issues as list or board.
5. **`feat: set project and cycle from issues`** — project and cycle pickers in the issue detail panel and create dialog.

### F5 Filters, views, search, keyboard — branch `frontend/5-find-and-keys`

User installs first: `pnpm add react-hotkeys-hook`.

1. **`feat: add filter bar`** — reusable `components/issues/filter-bar.tsx` producing the `issueFilter` object; state kept in the URL query string; issue pages switch to `api.issues.listFiltered` when any filter is set.
2. **`feat: add saved views`** — "Save view" from the filter bar; `app/[orgSlug]/views/page.tsx` (mine + shared) and `views/[viewId]/page.tsx`; share toggle hidden without `views.share`.
3. **`feat: add search page`** — `app/[orgSlug]/search/page.tsx`: input debounced 200 ms → `api.search.issues`.
4. **`feat: add command palette`** — shadcn `command` dialog on `Cmd/Ctrl+K`: navigation, create issue, switch team, search issues, and (inside an issue) change state/assignee/priority.
5. **`feat: add keyboard shortcuts`** — `lib/shortcuts.ts` as the single map: `c` create issue, `/` search, `g i` my issues, `g p` projects, `j`/`k` move selection, `Enter` open, `s` state, `a` assign, `p` priority, `l` labels, `?` help sheet listing them. Disabled while typing in an input.

### F6 Settings and billing — branch `frontend/6-settings-billing`

1. **`feat: add settings layout`** — `app/[orgSlug]/settings/layout.tsx` with nav: General, Members, Teams, Labels, Billing, Roles, Audit log.
2. **`feat: add members and organization settings`** — `settings/members/[[...rest]]/page.tsx` rendering Clerk `<OrganizationProfile />` inside `<Suspense>` (members, invitations, org profile).
3. **`feat: add team and label settings`** — edit team name/privacy/members, workflow states (add, rename, reorder, delete), labels CRUD.
4. **`feat: add billing page`** — `settings/billing/page.tsx`: current plan and AI usage from `api.billing.currentPlan` / `api.ai.usage`, and `<PricingTable for="organization" />`; visible to admins only. After checkout call `clerk.session?.reload()`.
5. **`feat: add roles and audit log pages`** — roles CRUD + assign to members; audit log table with pagination; both show the upgrade prompt without the feature.
6. **`feat: add upgrade prompts`** — one `<UpgradePrompt feature="...">` component used at every gated entry point.

### F7 AI — branch `frontend/7-ai`

1. **`feat: add assistant panel`** — a right-side sheet opened from the sidebar and `Cmd/Ctrl+J`: thread list, message list from `api.ai.chat.listMessages`, composer calling `sendMessage`; pending state while the model works.
2. **`feat: add proposal confirmation cards`** — pending `aiProposals` render in the thread as a card listing each action in plain words with Apply and Dismiss; applied cards link to the issues.
3. **`feat: add issue suggestions`** — on issue detail: suggested labels/priority as chips with accept/dismiss; "Summarize" button showing the summary; "Possible duplicates" list.
4. **`feat: add reports`** — "Generate summary" on cycle and project pages and "Standup digest" in the assistant; result rendered as Markdown with a copy button.
5. **`feat: add AI limit and unavailable states`** — usage meter; friendly messages for `LIMIT_REACHED` and `MODEL_UNAVAILABLE`; whole panel replaced by the upgrade prompt without `ai_assistant`.

---

## Verification

- **Every backend phase:** `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`; each phase's tests include wrong-org and wrong-role refusals.
- **Billing (B2, F6):** on the Clerk dev gateway subscribe a test org to each plan; confirm `billing.currentPlan`, feature gates, the 3-seat Free cap at invite time, and `subscriptions` rows.
- **Every frontend phase:** `pnpm build`; run `pnpm frontend` and `pnpm backend`; drive the phase's flows in the browser with two users in two orgs; confirm live updates appear in the other window without reload.
- **End to end (after F7):** create org → invite member → create team and issue → drag on board → cycle rollover → upgrade to Pro → assistant proposes an issue → confirm → issue exists with "via assistant" activity → downgrade → AI panel shows upgrade prompt.