"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authorizeOrder } from "@/app/actions/checkout"

export function AuthorizeOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()

  function authorize() {
    startTransition(async () => {
      const res = await authorizeOrder(orderId)
      if (res.ok) {
        toast.success("Pago autorizado. Ahora confirma para reservar los fondos.")
        return
      }
      toast.error(res.error ?? "No pudimos autorizar el pago.")
    })
  }

  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={authorize}>
      {pending ? "Autorizando…" : "Autorizar pago"}
    </Button>
  )
}
