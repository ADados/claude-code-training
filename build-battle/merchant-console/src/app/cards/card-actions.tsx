"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"

/**
 * Freeze/unfreeze and cancel, without a full page reload: `PATCH` the
 * status, then `router.refresh()` to re-render the server components with
 * the new data. `cancelled` is terminal — asked to confirm before it's sent,
 * since nothing comes back from it.
 */
export function CardActions({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const transition = async (next: CardStatus) => {
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.message ?? "Something went wrong. Try again.")
        return
      }
      setConfirmingCancel(false)
      startTransition(() => router.refresh())
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    }
  }

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        Cancelled — this card cannot be reactivated.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={isPending}
            onClick={() => transition("frozen")}
          >
            Freeze
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={isPending}
            onClick={() => transition("active")}
          >
            Unfreeze
          </Button>
        )}

        {!confirmingCancel ? (
          <Button
            variant="destructive"
            className="py-1.5"
            disabled={isPending}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel card
          </Button>
        ) : (
          <>
            <span className="text-sm text-gray-500">
              Cancelling can&apos;t be undone.
            </span>
            <Button
              variant="destructive"
              className="py-1.5"
              disabled={isPending}
              onClick={() => transition("cancelled")}
            >
              Confirm cancel
            </Button>
            <Button
              variant="ghost"
              className="py-1.5"
              disabled={isPending}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep card
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
