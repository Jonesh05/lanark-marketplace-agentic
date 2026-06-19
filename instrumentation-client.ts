import * as Sentry from "@sentry/nextjs"

// Browser/client runtime. Next.js bundles this for the browser, where the full
// client API (replayIntegration, captureRouterTransitionStart, captureException)
// is available — these are undefined in the Node server export, which is why
// they live here and not in instrumentation.ts. No-op unless the DSN is set.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  // Session Replay: 10% of all sessions, 100% of sessions with an error.
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [Sentry.replayIntegration()],
})

// App Router navigation transition tracing. Next.js invokes this optionally.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
