import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    // Disable built-in image optimization in development to avoid
    // server-side fetch/validation errors for third-party CDNs like
    // custom Cloudinary hostnames. In production this remains enabled.
    unoptimized: process.env.NODE_ENV !== "production",
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "blobs.vusercontent.net" },
      // Cloudinary hosts used by product images
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.cloudinary.com" },
      { protocol: "https", hostname: "collection.cloudinary.com" },
    ],
  },

  serverExternalPackages: ["pino", "pino-pretty", "lokijs", "encoding"],
  turbopack: {
    resolveAlias: {
      // wagmi/core does an optional `import('accounts')`; stub it so the
      // bundler doesn't fail on a non-existent module. Path is project-relative.
      accounts: "./lib/shims/accounts.ts",
    },
  },
}

// withSentryConfig wraps the Next config to enable server instrumentation,
// source-map upload on `next build`, and the ad-blocker tunnel route. The
// SDK init still lives in instrumentation*.ts / sentry.*.config.ts.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG ?? "greenchain",
  project: process.env.SENTRY_PROJECT ?? "lanark-marketplace",
  // Source-map upload token. Read from .env (gitignored); only used at build.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Upload a wider set of client source files for better stack traces.
  widenClientFileUpload: true,
  // Proxy Sentry ingest through the app to bypass ad-blockers.
  tunnelRoute: "/monitoring",
  // Suppress plugin output outside CI.
  silent: !process.env.CI,
})
