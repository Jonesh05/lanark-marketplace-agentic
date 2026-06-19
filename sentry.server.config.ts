import * as Sentry from "@sentry/nextjs"

// Node.js server runtime. Loaded by instrumentation.ts register() when
// NEXT_RUNTIME === "nodejs". No-op when SENTRY_DSN is unset.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Attach local variable values to server stack frames for richer triage.
  includeLocalVariables: true,
  enableLogs: true,
})
