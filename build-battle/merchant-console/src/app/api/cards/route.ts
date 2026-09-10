import { issueCard, listCards } from "@/data/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { NextRequest, NextResponse } from "next/server"

/**
 * Cards never carry a full number — `Card` only has `last4` and `reference`
 * — so a list response can never leak one by construction. The full number
 * exists only in the `POST` response below, once, right after issuing.
 */
export function GET() {
  return NextResponse.json(listCards())
}

/**
 * Issues a card. `limit` arrives as a decimal string ("250.00") the same way
 * every other money input at the boundary does — parsed to minor units here,
 * once, before validation, per `.claude/rules/money.md`. Everything else is
 * checked against the allowlists in `@/lib/cards` before it reaches the
 * store; a 400 with `{ message }` is the one error shape this route returns.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 })
  }

  const limit =
    typeof body.limit === "string" ? parseAmountToMinorUnits(body.limit) : null
  if (limit === null) {
    return NextResponse.json(
      { message: "Enter a valid spend limit, e.g. 250.00." },
      { status: 400 },
    )
  }

  const result = issueCard({
    nickname: body.nickname,
    merchantId: body.merchantId,
    limit,
    currency: body.currency,
    category: body.category,
    idempotencyKey: body.idempotencyKey,
  })

  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 400 })
  }

  return NextResponse.json(result, { status: 201 })
}
