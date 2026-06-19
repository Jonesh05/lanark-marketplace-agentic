"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { confirmOrder } from "@/app/actions/orders"

export function ConfirmOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()

  function confirm() {
    startTransition(async () => {
      const res = await confirmOrder(orderId)
      if (res.ok) {
        toast.success("Payment pending — funds reserved for settlement.")
        return
      }
      if (res.error === "insufficient_funds") {
        toast.error(
          `Insufficient USDm balance. You have ${res.balanceCusd} USDm but need ${res.requiredCusd} USDm.`,
        )
        return
      }
      toast.error(res.error ?? "Could not confirm the order")
    })
  }

  return (
    <Button size="sm" disabled={pending} onClick={confirm}>
      {pending ? "Confirming…" : "Confirm & pay"}
    </Button>
  )
}
