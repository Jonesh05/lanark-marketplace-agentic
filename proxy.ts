import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

// Next.js 16 renamed `middleware.ts` -> `proxy.ts`. This file is the
// per-request edge entry point. We export both `proxy` (Next 16) and a
// default function so the loader picks it up regardless of the resolution
// path it takes during dev compilation.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export default proxy

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
