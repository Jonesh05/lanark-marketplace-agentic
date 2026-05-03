import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { headers } from "next/headers"
import { cookieToInitialState } from "wagmi"
import { Toaster } from "sonner"

import { wagmiConfig } from "@/lib/reown/config"
import { ReownProvider } from "@/components/providers/reown-provider"
import { ThemeProvider } from "@/components/providers/theme-provider"
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
  title: "Sablon — Agentic on-chain marketplace",
  description:
    "Place, accept and settle marketplace offers in cUSD on Celo. An AI agent runs the loop end-to-end.",
  generator: "v0.app",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#111418",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Hydrate wagmi state from cookies so wallet connections survive SSR.
  const cookieHeader = (await headers()).get("cookie")
  const initialState = cookieToInitialState(wagmiConfig, cookieHeader)

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
          <ReownProvider initialState={initialState}>
            {children}
            <Toaster theme="dark" position="bottom-right" />
          </ReownProvider>
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
