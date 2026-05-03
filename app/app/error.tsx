"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SurfaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] surface error:", error)
  }, [error])

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Surface error
      </div>
      <h1 className="max-w-md font-serif text-3xl tracking-tight text-balance">
        The agent surface couldn&apos;t load.
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
