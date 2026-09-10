import {
  canTransition,
  generateCardNumber,
  validateIssueCardInput,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * The card mutation layer, sibling to `queries.ts` for payments. Every route
 * handler that touches a card goes through here rather than the store
 * directly — one place to keep "generate server-side," "reveal once," and
 * "cancelled is terminal" true.
 */

let cardSeq = store.cards.length

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

/**
 * Guards a retried `POST /api/cards` (a double-click, a network retry)
 * against issuing a second card. Held on `globalThis` for the same reason
 * `store.ts` holds the store there: dev-server hot reload must not hand a
 * repeated request a fresh, empty map. Keyed by a client-generated
 * idempotency key, never by anything derived from the card itself.
 */
declare global {
  // eslint-disable-next-line no-var
  var __northwindCardIdempotency: Map<string, IssueCardResult> | undefined
}
const idempotency: Map<string, IssueCardResult> =
  globalThis.__northwindCardIdempotency ?? new Map()
if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindCardIdempotency = idempotency
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export interface IssueCardResult {
  card: Card
  /** The full generated number. Exists only on this return value — never stored. */
  number: string
}

/**
 * Validates against the allowlists in `@/lib/cards`, generates the number
 * server-side, and appends the new card to the store. Returns the full
 * number alongside the card record so the route can hand it back exactly
 * once; nothing after this function ever sees it again.
 */
export function issueCard(input: {
  nickname: unknown
  merchantId: unknown
  limit: unknown
  currency: unknown
  category: unknown
  /** Optional. A repeat of the same key returns the original result instead
   *  of creating a second card — see `idempotency` above. */
  idempotencyKey?: unknown
}): { error: string } | IssueCardResult {
  const key = typeof input.idempotencyKey === "string" ? input.idempotencyKey : undefined
  if (key && idempotency.has(key)) return idempotency.get(key)!

  const merchant =
    typeof input.merchantId === "string" ? merchantById(input.merchantId) : undefined

  const error = validateIssueCardInput({
    ...input,
    merchantExists: Boolean(merchant),
    merchantCurrency: merchant?.currency,
  })
  if (error) return { error }

  const number = generateCardNumber()
  const now = new Date().toISOString()

  const card: Card = {
    id: `card_${pad(++cardSeq)}`,
    nickname: (input.nickname as string).trim(),
    merchantId: input.merchantId as string,
    last4: number.slice(-4),
    reference: `ref_${pad(cardSeq)}`,
    limit: input.limit as number,
    spent: 0,
    currency: input.currency as Card["currency"],
    status: "active",
    category: input.category as Card["category"],
    createdAt: now,
    history: [{ status: "active", at: now }],
  }

  store.cards.push(card)
  const result: IssueCardResult = { card, number }
  if (key) idempotency.set(key, result)
  return result
}

/**
 * Server-enforced status transition. `active ⇄ frozen`, either → `cancelled`,
 * and `cancelled` is terminal — `canTransition` is the one guard, not
 * re-checked or re-implemented here.
 */
export function transitionCard(
  id: string,
  next: CardStatus,
): { error: string; status: 404 | 409 } | { card: Card } {
  const card = cardById(id)
  if (!card) return { error: "Card not found.", status: 404 }

  if (!canTransition(card.status, next)) {
    return {
      error: `Cannot move a ${card.status} card to ${next}.`,
      status: 409,
    }
  }

  card.status = next
  card.history.push({ status: next, at: new Date().toISOString() })
  return { card }
}
