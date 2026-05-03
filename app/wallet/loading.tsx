export default function WalletLoading() {
  return (
    <div className="min-h-svh">
      <div className="sticky top-0 z-40 h-14 border-b border-border/60 bg-background/70 backdrop-blur" />
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
        <div className="flex flex-col gap-3 border-b border-border/60 pb-6">
          <div className="h-3 w-16 animate-pulse rounded bg-card/40" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-card/40" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-card/40" />
        </div>
        <div className="h-32 animate-pulse rounded-xl border border-border/60 bg-card/40" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-xl border border-border/60 bg-card/40" />
          <div className="h-24 animate-pulse rounded-xl border border-border/60 bg-card/40" />
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          Loading wallet…
        </div>
      </main>
    </div>
  )
}
