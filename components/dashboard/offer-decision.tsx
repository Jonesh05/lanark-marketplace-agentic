"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { decideOffer } from "@/app/actions/offers"

export function OfferDecisionButtons({ offerId }: { offerId: string }) {
  const [pending, startTransition] = useTransition()

  function decide(decision: "accepted" | "rejected") {
    startTransition(async () => {
      const res = await decideOffer(offerId, decision)
      if (!res.ok) toast.error(res.error)
      else toast.success(`Offer ${decision}.`)
    })
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => decide("rejected")}
      >
        Reject
      </Button>
      <Button size="sm" disabled={pending} onClick={() => decide("accepted")}>
        Accept
      </Button>
    </div>
  )
}
