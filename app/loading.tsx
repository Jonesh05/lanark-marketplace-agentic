import { Loader2 } from "lucide-react"

export default function RootLoading() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
        Sablon
      </span>
    </div>
  )
}
