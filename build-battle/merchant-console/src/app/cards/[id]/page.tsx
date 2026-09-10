import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone, formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
  any: "No lock",
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const percentSpent = card.limit > 0 ? Math.round((card.spent / card.limit) * 100) : 0
  const remaining = card.limit - card.spent
  const overThreshold = percentSpent > 80

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <CardStatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.reference}
      </p>

      <div className="mt-4">
        <CardActions id={card.id} status={card.status} />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category lock">{CATEGORY_LABELS[card.category]}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">{formatMoney(card.limit, card.currency)}</Field>
        <Field label="Spent">{formatMoney(card.spent, card.currency)}</Field>
        <Field label="Remaining">{formatMoney(remaining, card.currency)}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-md">
        <div
          role="progressbar"
          aria-valuenow={percentSpent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${percentSpent}% of limit spent`}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              overThreshold ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.min(percentSpent, 100)}%` }}
          />
        </div>
        <p
          className={cx(
            "mt-1.5 text-sm",
            overThreshold ? "text-amber-600 dark:text-amber-500" : "text-gray-500",
          )}
        >
          {percentSpent}% of {formatMoney(card.limit, card.currency)} spent
          {overThreshold ? " — past 80% of the limit" : ""}
        </p>
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                Status set to <span className="font-medium">{entry.status}</span>
              </p>
              <p className="text-sm text-gray-500">{formatDate(entry.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
