import * as Sentry from "@sentry/nextjs"

// Server-side registration hook. Next.js calls register() once per runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

// Captures all unhandled server-side request errors (App Router server
// components, route handlers, server actions). Requires @sentry/nextjs >= 8.28.
export const onRequestError = Sentry.captureRequestError
