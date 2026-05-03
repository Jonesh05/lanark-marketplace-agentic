import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

/**
 * Create a Supabase client for Route Handlers that properly handles
 * cookie setting. Returns both the client and a function to get the
 * response with cookies attached.
 */
export async function createRouteHandlerClient() {
  const cookieStore = await cookies()
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(newCookies) {
          // Collect cookies to set them on the response later
          cookiesToSet.push(...newCookies)
          // Also try to set them directly (works in some contexts)
          try {
            newCookies.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Ignore - we'll set them on the response
          }
        },
      },
    },
  )

  function createResponse(body: any, init?: ResponseInit) {
    const response = NextResponse.json(body, init)
    // Attach any cookies that were set during auth operations
    for (const { name, value, options } of cookiesToSet) {
      response.cookies.set(name, value, options)
    }
    return response
  }

  return { supabase, createResponse, cookiesToSet }
}
