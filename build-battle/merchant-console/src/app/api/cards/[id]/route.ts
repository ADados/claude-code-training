import { cardById, transitionCard } from "@/data/cards"
import { NextRequest, NextResponse } from "next/server"

const STATUSES = ["active", "frozen", "cancelled"] as const

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const card = cardById(id)
  if (!card) {
    return NextResponse.json({ message: "Card not found." }, { status: 404 })
  }
  return NextResponse.json(card)
}

/**
 * The only mutation a card supports post-issue: a status transition. The
 * target status is checked against the allowlist below before it ever
 * reaches `transitionCard`'s state-machine guard — client input, validated.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => null)

  if (!body || !STATUSES.includes(body.status)) {
    return NextResponse.json(
      { message: `status must be one of ${STATUSES.join(", ")}.` },
      { status: 400 },
    )
  }

  const result = transitionCard(id, body.status)
  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: result.status })
  }

  return NextResponse.json(result.card)
}
