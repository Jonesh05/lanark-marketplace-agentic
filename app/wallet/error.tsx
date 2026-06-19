"use client"

import { useEffect } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"

const CHUNK_RE =
  /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|importing a module script failed/i

/**
 * Route-level boundary for /wallet. The wallet bundle (wagmi + Reown AppKit) is
 * large and lazy-loaded; an on-demand chunk can fail to fetch (stale dev build
 * or post-deploy manifest change), which previously crashed the whole route at
 * the signing step. Here we auto-recover from chunk errors and report the rest.
 */
export default function WalletError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error("[lanark] wallet error:", error)

    const text = `${error?.name ?? ""} ${error?.message ?? ""}`
    if (typeof window === "undefined") return

    if (CHUNK_RE.test(text)) {
      const key = "lanark:wallet-chunk-reload"
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1")
        window.location.reload()
      }
    } else {
      sessionStorage.removeItem("lanark:wallet-chunk-reload")
    }
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60svh] max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Wallet
      </div>
      <h1 className="font-serif text-3xl tracking-tight text-balance">
        Reconectando tu wallet
      </h1>
      <p className="text-sm text-muted-foreground">
        Tuvimos un problema cargando el módulo de la wallet. Si no se reintenta
        solo, vuelve a intentarlo. Si estabas firmando un pago, no se movieron
        fondos: la orden queda en su último estado guardado.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          Reintentar
        </Button>
        <Button asChild>
          <Link href="/wallet">Recargar wallet</Link>
        </Button>
      </div>
    </main>
  )
}
