/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "blobs.vusercontent.net" },
      // DummyJSON catalog assets (cdn + alt host).
      { protocol: "https", hostname: "cdn.dummyjson.com" },
      { protocol: "https", hostname: "i.dummyjson.com" },
      { protocol: "https", hostname: "dummyjson.com" },
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

export default nextConfig
