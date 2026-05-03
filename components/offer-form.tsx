"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { placeOffer } from "@/app/actions/offers"
import type { Product } from "@/lib/types"

export function OfferForm({ product }: { product: Product }) {
  const [pending, startTransition] = useTransition()
  // Quote: assume 1 USD ≈ 4000 COP for the suggestion. Real conversion
  // happens via the agent; this is just an editable starting point.
  const suggestedCusd = +(product.price_cents / 100 / 4000).toFixed(2)
  const [qty, setQty] = useState(1)
  const [amount, setAmount] = useState(suggestedCusd.toString())

  return (
    <form
      action={(fd) => {
        startTransition(async () => {
          const res = await placeOffer(fd)
          if (!res.ok) toast.error(res.error)
          else toast.success("Offer placed. Awaiting shopkeeper.")
        })
      }}
      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-4"
    >
      <input type="hidden" name="product_id" value={product.id} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qty" className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Quantity
          </Label>
          <Input
            id="qty"
            name="qty"
            type="number"
            min={1}
            max={product.stock}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            required
            className="font-mono tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount_cusd" className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Offer in cUSD
          </Label>
          <Input
            id="amount_cusd"
            name="amount_cusd"
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="font-mono tabular-nums"
          />
        </div>
      </div>
      <Button type="submit" disabled={pending || product.stock < 1} className="h-11">
        {pending
          ? "Placing offer…"
          : product.stock < 1
            ? "Sold out"
            : `Place offer · ${amount || "0.00"} cUSD`}
      </Button>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        The agent will route this offer to the shopkeeper. On accept, your
        smart account approves cUSD and the bundler sponsors gas for your
        first trade.
      </p>
    </form>
  )
}
