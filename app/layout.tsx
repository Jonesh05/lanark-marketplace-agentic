import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "sonner"

import { ThemeProvider } from "@/components/providers/theme-provider"
import { FavoritesProvider } from "@/components/favorites/favorites-provider"
import "./globals.css"

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-instrument-serif",
})

export const metadata: Metadata = {
  title: "Lanark - Agentic on-chain marketplace",
  description:
    "Browse a real product catalog, place offers in plain English, and let an autonomous agent settle every trade in USDm on Celo.",
  generator: "v0.app",
}

export const viewport: Viewport = {
  themeColor: "#111418",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} bg-background dark`}
    >
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <FavoritesProvider>{children}</FavoritesProvider>
          <Toaster theme="dark" position="bottom-right" />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
