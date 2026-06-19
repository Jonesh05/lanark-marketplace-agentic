"use client"

import { useEffect } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"
import { Button } from "@/components/ui/button"

const CHUNK_RE =
  /ChunkLoadError|Loading chunk|Failed to load chunk|dynamically imported module|importing a module script failed/i

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error("[lanark] root error:", error)

    const text = `${error?.name ?? ""} ${error?.message ?? ""}`
    const isChunk = CHUNK_RE.test(text)
    if (typeof window === "undefined") return

    // A stale/failed code chunk (common after a deploy, or when an on-demand
    // wallet-modal chunk 404s in dev) is recoverable: reload once to pull the
    // fresh manifest. Guard against an infinite reload loop.
    if (isChunk) {
      const key = "lanark:chunk-reload"
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1")
        window.location.reload()
      }
    } else {
      sessionStorage.removeItem("lanark:chunk-reload")
    }
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Something broke
      </div>
      <h1 className="max-w-md font-serif text-3xl tracking-tight text-balance">
        We hit an error.
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  )
}
