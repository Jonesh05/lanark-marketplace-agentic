import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LoginPanel } from "@/components/auth/login-panel"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; role?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/dashboard")

  const sp = await searchParams
  const initialRole =
    sp.role === "shopkeeper" ? "shopkeeper" : ("client" as const)

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,oklch(0_0_0_/_0.4),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12">
        <Link
          href="/"
          className="flex items-center gap-2 self-start text-xs uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
        >
          <span className="h-1 w-6 bg-accent" />
          Lanark
        </Link>

        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-5xl leading-[0.95] tracking-tight text-balance">
            Step inside the
            <br />
            <span className="italic text-accent">marketplace.</span>
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sign in to place offers, list inventory, and let the agent settle
            on Celo for you. Gas is sponsored on your first trade.
          </p>
        </div>

        <LoginPanel initialRole={initialRole} />

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          By continuing you agree that signing the message proves wallet
          ownership. We never custody your keys; settlement happens through an
          ERC-4337 smart account on Celo.
        </p>
      </div>
    </main>
  )
}
