"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { CARD_CATEGORIES } from "@/lib/cards"
import { CardCategory } from "@/data/types"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
  any: "No lock",
}

type Merchant = { id: string; name: string; currency: string }

/**
 * Issues a card, then shows the full number exactly once. Currency is
 * derived from the chosen merchant rather than freely picked — a card bills
 * against one merchant, so a mismatched currency has no meaning here, and
 * the server rejects one anyway (`.lib/cards.ts`'s merchant-currency check).
 */
export function IssueCardDialog({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const nicknameId = useId()
  const merchantId = useId()
  const limitId = useId()
  const categoryId = useId()

  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [selectedMerchantId, setSelectedMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<CardCategory>("any")
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ number: string; last4: string } | null>(null)

  const merchant = merchants.find((m) => m.id === selectedMerchantId)

  const reset = () => {
    setNickname("")
    setSelectedMerchantId("")
    setLimit("")
    setCategory("any")
    setError(null)
    setIssued(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || !merchant) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId: selectedMerchantId,
          limit,
          currency: merchant.currency,
          category,
          idempotencyKey,
        }),
      })
      const body = await res.json().catch(() => null)

      if (!res.ok) {
        setError(body?.message ?? "Something went wrong. Try again.")
        return
      }

      setIssued({ number: body.number, last4: body.card.last4 })
      router.refresh()
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">Issue a card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. After you close
                this, it&apos;s <span className="font-mono">•••• {issued.last4}</span>{" "}
                everywhere.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p
                className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50"
                aria-label="Full card number"
              >
                {issued.number}
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Generated server-side, on the test BIN. The number is shown once,
                right after this.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor={nicknameId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id={nicknameId}
                  className="mt-1.5"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={merchantId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
                  <SelectTrigger id={merchantId} className="mt-1.5">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor={limitId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit {merchant ? `(${merchant.currency})` : ""}
                </label>
                <Input
                  id={limitId}
                  className="mt-1.5"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="250.00"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Up to 5,000,000 minor units. Currency follows the merchant.
                </p>
              </div>

              <div>
                <label
                  htmlFor={categoryId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id={categoryId} className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing…"
                disabled={!nickname || !selectedMerchantId || !limit}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
