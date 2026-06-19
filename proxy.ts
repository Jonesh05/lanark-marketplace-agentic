import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

// First-layer rate limiting for sensitive endpoints (SEC-04). In-memory and
// per-instance: it caps abuse cheaply at the edge but is not a distributed
// quota. For multi-instance hardening, back this with a shared store
// (e.g. Upstash Redis) keyed the same way.
const WINDOW_MS = 60_000
const LIMITS: Record<string, number> = {
  "/api/auth": 12,
  "/api/pef": 30,
}
const hits = new Map<string, { count: number; reset: number }>()

function rateLimitBucket(pathname: string): string | null {
  if (pathname.startsWith("/api/auth")) return "/api/auth"
  if (pathname.startsWith("/api/pef")) return "/api/pef"
  return null
}

function rateLimited(request: NextRequest): NextResponse | null {
  const bucket = rateLimitBucket(request.nextUrl.pathname)
  if (!bucket) return null

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anon"
  const key = `${bucket}:${ip}`
  const limit = LIMITS[bucket]
  const now = Date.now()

  const rec = hits.get(key)
  if (!rec || rec.reset < now) {
    hits.set(key, { count: 1, reset: now + WINDOW_MS })
    return null
  }

  rec.count += 1
  if (rec.count > limit) {
    return NextResponse.json(
      { ok: false, error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rec.reset - now) / 1000)) },
      },
    )
  }
  return null
}

// Next.js 16 looks for a single named `proxy` export (it replaces the legacy
// `middleware` convention). Keep this file dead-simple at the top level so
// Turbopack's static analysis can detect the export across HMR cycles.
export async function proxy(request: NextRequest) {
  // SEC-04: throttle sensitive endpoints before any heavier work.
  const limited = rateLimited(request)
  if (limited) return limited

  let response = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return response

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
