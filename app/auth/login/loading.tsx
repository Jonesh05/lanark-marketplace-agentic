export default function LoginLoading() {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,oklch(0_0_0_/_0.4),transparent_70%)]"
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12">
        <div className="flex items-center gap-2 self-start text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-1 w-6 bg-accent" />
          Sablon
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-12 w-3/4 animate-pulse rounded-md bg-card/40" />
          <div className="h-12 w-1/2 animate-pulse rounded-md bg-card/40" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-3 w-1/3 animate-pulse rounded bg-card/40" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-card/40" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="h-3 w-1/3 animate-pulse rounded bg-card/40" />
          <div className="h-12 w-full animate-pulse rounded-xl bg-card/40" />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Preparing wallet stack…
        </div>
      </div>
    </main>
  )
}
