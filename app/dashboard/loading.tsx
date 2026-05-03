import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Loading dashboard…
      </span>
    </div>
  )
}
