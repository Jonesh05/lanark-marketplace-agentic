"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authorizeOrder } from "@/app/actions/checkout"

export function AuthorizeOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function authorize() {
    startTransition(async () => {
      const res = await authorizeOrder(orderId)
      if (res.ok) {
        toast.success("Pago autorizado. Abriendo tu wallet…")
        router.replace(`/dashboard?pay=${orderId}`)
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
