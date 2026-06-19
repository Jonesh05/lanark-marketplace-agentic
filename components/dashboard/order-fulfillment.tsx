"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { advanceFulfillment, type FulfillmentAction } from "@/app/actions/orders"

const NEXT_ACTIONS: Record<
  string,
  { action: FulfillmentAction; label: string; variant?: "outline" }[]
> = {
  pending_review: [
    { action: "reject", label: "Rechazar", variant: "outline" },
    { action: "accept", label: "Aceptar" },
  ],
  accepted: [
    { action: "reject", label: "Rechazar", variant: "outline" },
    { action: "prepare", label: "Preparar" },
  ],
  preparing: [{ action: "dispatch", label: "Despachar" }],
  dispatched: [{ action: "deliver", label: "Marcar entregado" }],
}

const TOAST: Record<FulfillmentAction, string> = {
  accept: "Orden aceptada.",
  prepare: "Orden en preparación.",
  dispatch: "Orden despachada.",
  deliver: "Orden entregada.",
  reject: "Orden rechazada y stock restaurado.",
}

export function OrderFulfillmentActions({
  orderId,
  status,
}: {
  orderId: string
  status: string
}) {
  const [pending, startTransition] = useTransition()
  const actions = NEXT_ACTIONS[status] ?? []
  if (actions.length === 0) return null

  function run(action: FulfillmentAction) {
    startTransition(async () => {
      const res = await advanceFulfillment(orderId, action)
      if (!res.ok) toast.error(res.error)
      else toast.success(TOAST[action])
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <Button
          key={a.action}
          size="sm"
          variant={a.variant}
          disabled={pending}
          onClick={() => run(a.action)}
        >
          {a.label}
        </Button>
      ))}
    </div>
  )
}
