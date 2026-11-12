<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

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


## Graphify

Before exploring files, run `graphify query "<question>"`; after changing code run `graphify update .`
