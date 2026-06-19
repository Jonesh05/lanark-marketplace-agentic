import * as Sentry from "@sentry/nextjs"

// Edge runtime (middleware, edge route handlers). Loaded by instrumentation.ts
// register() when NEXT_RUNTIME === "edge". No-op when SENTRY_DSN is unset.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,
})
