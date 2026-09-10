import { CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Virtual card issuing. Numbers are generated here, server-side only, on the
 * `4242` test BIN with a valid Luhn check digit — nothing in this repository
 * may resemble a real PAN. The full number is a return value, never a field;
 * callers decide once whether to show it, and never store it.
 */

export const CARD_BIN = "4242"
export const CARD_NUMBER_LENGTH = 16

export const CARD_LIMIT_MAX = 5_000_000

export const CARD_CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORIES: readonly CardCategory[] = [
  "advertising",
  "software",
  "contractors",
  "travel",
  "any",
]

/** Luhn check digit for a string of digits (the number without its final digit). */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  // Walk right to left; every second digit (starting from the rightmost of
  // the input, which becomes even-indexed here) is doubled.
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** Whether a full digit string (including its check digit) is Luhn-valid. */
export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === Number(number.at(-1))
}

/**
 * A 16-digit number on the `4242` test BIN with a valid Luhn check digit.
 * `random` is injectable so tests can assert on specific digit strings.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const bodyLength = CARD_NUMBER_LENGTH - CARD_BIN.length - 1
  let body = ""
  for (let i = 0; i < bodyLength; i++) {
    body += Math.floor(random() * 10)
  }
  const withoutCheckDigit = CARD_BIN + body
  return withoutCheckDigit + luhnCheckDigit(withoutCheckDigit)
}

/** `4242123456789012` → `•••• 9012`. Every display outside the reveal screen uses this. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * `active ⇄ frozen`, either can go to `cancelled`, and `cancelled` is
 * terminal. Enforced here so every caller (routes, tests) shares one guard —
 * a second implementation of this table is a defect, not a convenience.
 */
const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

export interface IssueCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category: CardCategory
}

/**
 * Server-side validation against allowlists, per `.claude/rules/api-routes.md`.
 * Client-side checks are UX only — this is the enforcement. Returns a single
 * message on the first failing check (reject early, one error shape).
 */
export function validateIssueCardInput(input: {
  nickname: unknown
  merchantId: unknown
  merchantExists: boolean
  /** The merchant's own currency, when the merchant was found. A card bills
   *  against one merchant, so its currency can't be one the merchant doesn't
   *  use — this is the cross-check `Card`/`Payment` already imply everywhere
   *  else money and a merchant meet. */
  merchantCurrency?: Currency
  limit: unknown
  currency: unknown
  category: unknown
}): string | null {
  if (typeof input.nickname !== "string" || input.nickname.trim() === "") {
    return "A nickname is required."
  }
  if (typeof input.merchantId !== "string" || !input.merchantId) {
    return "A merchant is required."
  }
  if (!input.merchantExists) {
    return "Unknown merchant."
  }
  if (
    typeof input.limit !== "number" ||
    !Number.isInteger(input.limit) ||
    input.limit <= 0
  ) {
    return "The spend limit must be a positive whole number of minor units."
  }
  if (input.limit > CARD_LIMIT_MAX) {
    return `The spend limit cannot exceed ${CARD_LIMIT_MAX.toLocaleString()} minor units.`
  }
  if (!CARD_CURRENCIES.includes(input.currency as Currency)) {
    return `Currency must be one of ${CARD_CURRENCIES.join(", ")}.`
  }
  if (input.merchantCurrency && input.currency !== input.merchantCurrency) {
    return `Card currency must match the merchant's currency (${input.merchantCurrency}).`
  }
  if (!CARD_CATEGORIES.includes(input.category as CardCategory)) {
    return `Category must be one of ${CARD_CATEGORIES.join(", ")}.`
  }
  return null
}
