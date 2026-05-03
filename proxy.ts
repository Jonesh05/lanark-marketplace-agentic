import { type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"

// Next.js 16 renamed `middleware.ts` -> `proxy.ts`. This file is the
// per-request edge entry point.
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
