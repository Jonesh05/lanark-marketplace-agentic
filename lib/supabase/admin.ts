import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role client. Use ONLY on the server. Never inside RSC components
 * that render to the client - keep this strictly inside route handlers and
 * server actions.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error("Supabase admin env vars are not configured")
  }
  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
