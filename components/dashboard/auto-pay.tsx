"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SettleOrderButton } from "@/components/dashboard/settle-order"

function AutoPayInner() {
  const router = useRouter()
  const params = useSearchParams()
  const orderId = params.get("pay")
  if (!orderId) return null

  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <SettleOrderButton
        orderId={orderId}
        autoRun
        onSettled={() => {
          router.replace("/dashboard")
          router.refresh()
        }}
      />
    </div>
  )
}

/** Opens the wallet automatically when landing from cart checkout (?pay=orderId). */
export function DashboardAutoPay() {
  return (
    <Suspense fallback={null}>
      <AutoPayInner />
    </Suspense>
  )
}
