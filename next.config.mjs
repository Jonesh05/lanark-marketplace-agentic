/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "blobs.vusercontent.net" },
    ],
  },
  // Reown / WalletConnect / pino transitive deps that don't exist in the
  // edge or browser bundles. Mark them external so webpack stops trying to
  // resolve them at build time.
  webpack: (config) => {
    config.externals = [
      ...(config.externals ?? []),
      "pino-pretty",
      "lokijs",
      "encoding",
    ]
    return config
  },
}

export default nextConfig
