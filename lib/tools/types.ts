/**
 * Tool Context - Dependencies injected into each tool
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type ToolContext = {
  supabase: SupabaseClient
  userId: string
  role: "client" | "shopkeeper"
  threadId: string
}

export type ToolResult<T = unknown> = 
  | { ok: true; data: T }
  | { ok: false; error: string }
