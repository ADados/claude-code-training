# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Build Battle
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand: 12–20 times a week, hours of turnaround, and two cards last month went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants issuing, listing, and inspecting cards inside the console itself, so a limit is typed once by the person who owns it.

## Current state

Nothing card-shaped exists yet.

- `src/data/types.ts` has no `Card` type. `Payment` carries `method`, `cardBrand`, `last4` — payment-method metadata, not an issued-card entity.
- `src/data/generate.ts:99-101` generates a random `last4` per card payment (`String(between(1000, 9999))`) with no Luhn check — not reusable for real card numbers.
- `src/data/store.ts:16-22` — `Store` has `merchants, payments, refunds, disputes, payouts`. No `cards` array, and **no module currently writes to the store** — every existing route is `GET` only (`src/app/api/payments/route.ts`, `src/app/api/payments/export/route.ts`). This ticket introduces the first mutation.
- `src/lib/money.ts:46` — `parseAmountToMinorUnits(input: string): number | null` already parses a decimal string into minor units at the boundary; reuse it for the limit field rather than writing a second parser.
- `src/app/payments/[id]/page.tsx` is the pattern for a detail page: async server component, `params: Promise<{id}>`, `notFound()` on miss, a `Field` helper over a `<dl>` grid.
- `src/app/payments/page.tsx:90-104` is the only existing empty-state pattern (`rows.length === 0`).
- `src/app/payments/export-dialog.tsx` is the only existing client component that talks to an API route (a `GET`, via `useEffect`+`fetch`) and the only place `Drawer` is used outside its own definition — the pattern to copy for the issue-card dialog and for the first `POST`.
- `src/components/ui/payments/StatusBadge.tsx:5` — `AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`, three parallel `Record` maps (`LABELS`, `DOTS`, `VARIANTS`). Adding `CardStatus` here means widening the union and adding three entries; `active`/`frozen`/`cancelled` don't collide with existing keys.
- `src/components/ui/navigation/AppSidebar.tsx:26-51` — nav is a `const navigation = [...] as const` array of `{name, href, icon, notifications}`; `href` comes from `src/app/siteConfig.ts:5-10` (`baseLinks`). `CreditCard` icon is already used by Payments, so Cards needs a different lucide icon.
- `src/components/ui/navigation/Breadcrumbs.tsx:7-12` — flat `LABELS: Record<string,string>` keyed by path segment, `?? segment` fallback.
- `src/data/merchants.ts` — `Merchant` has no category/MCC field, so "merchant category lock" (stretch) is a card-level choice at issue time, not a merchant property.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, never a float or a string with a symbol | `CLAUDE.md`, ticket rule 1 | A `$250.00` limit stored as `250.00` drifts the moment it's compared or summed |
| Format once, at the edge | `.claude/rules/money.md` | A formatted string re-entering a comparison silently breaks the >0 / ≤5,000,000 checks |
| Numbers generated server-side, `4242` BIN, valid Luhn | ticket rule 4, `.claude/rules/cards.md` | A client-generated or non-Luhn number could resemble a real PAN or fail card-network validation later |
| Full PAN returned exactly once, in the creation response; stored record carries only `last4` + a reference | ticket rule 2, `.claude/rules/cards.md` | A re-readable full number is a PCI-shaped leak, and the whole reason this codebase distinguishes payments from cards |
| Mask `•••• 4242` everywhere else | `.claude/rules/cards.md` | A list or detail view showing digits 5-12 defeats the point of masking |
| Status machine `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal, enforced server-side | ticket rule 3, `.claude/rules/cards.md` | A client-only guard lets a stale tab revive a cancelled card |
| Validate on the server against an allowlist; client checks are UX only | `.claude/rules/api-routes.md` | A missing merchant, bad currency, or out-of-range limit reaches the store |
| One shared error shape, reject early | `.claude/rules/api-routes.md` | Inconsistent error bodies make the UI's error handling a special case per route |
| No persistence, no auth, no limit editing | ticket "Out of scope" | Building any of these spends the clock on work the ticket explicitly excludes |

## Approach

Put all card logic in one pure, unit-testable module, `src/lib/cards.ts` (Luhn generation/validation, the status-transition table, and the currency/limit/category allowlists), mirroring how `src/lib/money.ts` and `src/lib/dates.ts` hold the codebase's other domain rules. Store mutations live in a new `src/data/cards.ts`, a sibling of `src/data/queries.ts`, so route handlers stay thin (`GET`/`POST`/`PATCH` calling one function each) the same way `api/payments/route.ts` calls `queryPayments`. UI reuses existing primitives only: `Drawer` for the issue dialog (already proven by `export-dialog.tsx`), `Table`/`StatusBadge`/`Divider`/`Button`/`Input`/`Select`, and `formatMoney`/`formatInZone`/`formatDate`.

**Considered and rejected:** generating the card number inside the route handler instead of a separate `cards.ts` lib. Rejected because the Luhn generator and the state machine are exactly the kind of logic the ticket's stretch goal wants unit-tested beside the code it covers (`src/lib/cards.test.ts`), and a route handler isn't importable by a test the way a lib function is.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add `CardStatus`, `CardCategory`, `Card` | The entity nothing above currently models |
| `src/lib/cards.ts` | New | Luhn check/generate, transition table, allowlists — the one place all four domain-rule checks live |
| `src/lib/cards.test.ts` | New | Stretch: Luhn correctness, generated numbers pass Luhn and start `4242`, every transition edge |
| `src/data/store.ts` | Add `cards: Card[]` to `Store`/`createStore` | First store field this ticket touches |
| `src/data/generate.ts` | Seed a handful of cards | List/detail/spend-bar need something to show without a live POST first |
| `src/data/cards.ts` | New: `listCards`, `cardById`, `issueCard`, `transitionCard` | The mutation layer; mirrors `queries.ts`'s shape for payments |
| `src/app/api/cards/route.ts` | New: `GET` (masked list), `POST` (issue) | First POST route in the app |
| `src/app/api/cards/[id]/route.ts` | New: `GET` (detail), `PATCH` (status) | Server-enforced transition guard |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | Add a Cards entry | Make the feature reachable |
| `src/components/ui/payments/StatusBadge.tsx` | Widen `AnyStatus` with `CardStatus` | Reuse the existing badge instead of a second one |
| `src/app/cards/page.tsx` | New: list | Core criterion |
| `src/app/cards/issue-card-dialog.tsx` | New: client dialog + reveal screen | Core criterion (issue + reveal-once) |
| `src/app/cards/card-actions.tsx` | New: client freeze/unfreeze/cancel | Stretch (no full reload) |
| `src/app/cards/[id]/page.tsx` | New: detail | Core criterion |

## Plan

1. **Types + `src/lib/cards.ts` + tests** — done when: `npm test` passes with new Luhn/transition cases.
2. **Store field + seed data** — done when: `store.cards` has a few deterministic cards, `npx tsc --noEmit` clean.
3. **`src/data/cards.ts` mutation layer** — done when: calling `issueCard` from a scratch script/test returns `{card, number}` with validation errors on bad input.
4. **Routes** — done when: a curl matrix (valid issue, missing merchant, 0 limit, 5,000,001, `JPY`, unknown id PATCH, illegal transition) returns the right status codes and the GET responses never contain a full number.
5. **Nav + badge wiring** — done when: `/cards` is reachable from the sidebar with a working breadcrumb.
6. **List + detail pages** — done when: browser shows the list and a card's detail page with masked number and spend bar.
7. **Issue dialog + reveal-once** — done when: submitting shows the full number exactly once, and it's gone from the DOM after closing.
8. **Freeze/unfreeze/cancel actions** — done when: clicking them updates status without a full page navigation.
9. **`/ship-ready` + `org-standards`** — done when: both pass clean or every finding is fixed.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form | Browser: fill nickname/merchant/limit/currency, submit, card appears in `/cards` |
| Card list at `/cards` | Browser screenshot: nickname, merchant, masked number, limit, status, created date columns present |
| Card detail | Browser: open a card, see full record + spend vs. limit |
| Generated numbers, `4242` BIN, valid Luhn | `src/lib/cards.test.ts` asserts both on every generated number |
| Reveal once, mask forever | Browser: number shown once on success screen; curl GET list/detail confirm no `number` field ever appears |
| Server-side validation | curl matrix: missing merchant, limit ≤0, limit >5,000,000, currency outside USD/EUR/GBP all return 400 with a message |

## Risks

- Time pressure (45-minute framing) — mitigated by building server-first and checkpointing with curl before any UI exists, so a UI bug never blocks the higher-weighted correctness score.
- First mutation in a store held on `globalThis` — verified by issuing a card twice in the running dev server and confirming the second `GET /api/cards` includes both.

## Out of scope

- Persistence, auth, real card-network calls, editing a limit after issue — per the ticket, and confirmed nothing in the current codebase does any of these either.
- Fixing the pre-existing string-comparison bug in `sortPayments` (`src/data/queries.ts`) found during NWP-101 — unrelated to this ticket's diff.

## Open questions

- None blocking. Currency defaults to the merchant's own `currency` (`src/data/types.ts` `Merchant.currency`) unless ops overrides it, since every other money field in this codebase follows the merchant's currency by default.
