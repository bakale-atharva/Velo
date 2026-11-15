# Clerk Billing configuration (development instance)

What is actually configured in Clerk for Velo's Organization Plans. The backend
reads plans from the synced `subscriptions` table plus `convex/lib/plans.ts`;
the slugs and feature slugs below must match that file.

## How it was set up

- Org billing enabled with `clerk enable billing --for org` (Clerk created `free_org`).
- Features and plans created with `clerk config patch` (Clerk CLI 4.1.0), dry-run first.
- **Seat limits are not configured in Clerk.** Clerk seat caps above 20 need the
  paid B2B Authentication add-on, the billing config API rejects every seat
  field, and the dashboard would not let us edit `free_org` seats. Velo
  enforces seats itself in Convex instead (see "Seat limits").

## Features

| Slug | Name | Plans |
|---|---|---|
| `ai_assistant` | AI assistant | pro, business, enterprise |
| `custom_roles` | Custom roles | business, enterprise |
| `audit_log` | Audit log | business, enterprise |
| `private_teams` | Private teams | business, enterprise |

All are `publicly_visible: true` and included in the session JWT (Clerk default).

## Plans (payer type: org, currency: USD)

| Slug | Name | Monthly | Yearly (per month) | Base fee | Seats (enforced in Convex) | Features |
|---|---|---|---|---|---|---|
| `free_org` | Free | $0 | $0 | no | 3 | none |
| `pro` | Pro | $199 | $169 | yes | 20 (hard cap) | `ai_assistant` |
| `business` | Business | **not set yet** ($0) | **not set yet** ($0) | no | unlimited | all four |
| `enterprise` | Enterprise | $990 | $900 | yes | unlimited | all four |

Business was meant to be $18 / $16 per seat. Clerk cannot charge per seat, so
its price is still $0 until a flat price is chosen. Pro's planned
+$12 / $10 per seat over 20 cannot be billed either, so Pro is capped at 20.

## Seat limits (Velo-enforced)

- `SEAT_LIMIT` in `convex/lib/plans.ts`: `free_org` 3, `pro` 20, `business` and
  `enterprise` unlimited.
- Clerk still lets anyone be invited. `requireMember` (called by every public
  Convex function) lets in admins plus the earliest-joined members up to the
  limit; anyone beyond that gets `SEAT_LIMIT_REACHED` until a seat frees up or
  the org upgrades.
- `billing.seats` returns `{ used, limit }` for the UI.

## Limits found

- The Clerk billing config API (`clerk config patch`, key `billing.plans`) only
  accepts `amount`, `annual_monthly_amount`, `currency`, `description`,
  `features`, `free_trial_*`, `is_recurring`, `name`, `payer_type`,
  `publicly_visible`. A dry-run with `seat_limit` added is rejected with
  `400 config_key_body_invalid`. Seat limits and per-seat fees cannot be set
  from the CLI.
- The Backend API plan object (`GET /billing/plans`) exposes `has_base_fee` but
  no seat fields.
