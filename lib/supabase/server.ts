import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Per-request Supabase client. Don't cache in module scope: Fluid compute
 * shares modules across requests and cookies are request-scoped.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll called from a Server Component - ignore; refresh
            // happens in proxy.ts
          }
        },
      },
    },
  )
}
