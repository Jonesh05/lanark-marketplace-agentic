"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

/**
 * Dashboard segment error boundary.
 *
 * The dashboard tree does several server reads and triggers settlement actions
 * (?pay=). If any of them throws, Next would otherwise surface a raw, stripped
 * production digest ("An error occurred in the Server Components render…").
 * This boundary keeps the buyer in a recoverable state with a friendly retry
 * instead of leaking that digest text, and never exposes payment internals.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side stack stays in the platform logs; surface only the digest id.
    console.error("[lanark] dashboard error:", error?.digest ?? error?.message ?? error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Dashboard
      </div>
      <h1 className="font-serif text-3xl tracking-tight text-balance">
        No pudimos cargar tu panel.
      </h1>
      <p className="text-sm text-muted-foreground">
        Hubo un problema temporal al leer tus órdenes. Tus datos y tus pagos
        están intactos. Intenta de nuevo.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button asChild variant="outline">
          <Link href="/">Ir al marketplace</Link>
        </Button>
      </div>
    </main>
  )
}
