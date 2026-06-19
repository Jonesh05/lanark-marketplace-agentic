/**
 * Provider-agnostic user notification adapter.
 *
 * The purchase flow calls `notifyUser(...)` with a real message destined for the
 * buyer's phone (profiles.phone). Every attempt is recorded in the
 * `notifications` table so the flow is auditable even when no SMS/WhatsApp
 * provider is configured yet ("queued"/"skipped" vs "sent"/"failed").
 *
 * Wiring a provider later is a single function: implement `sendViaProvider` for
 * Twilio or WhatsApp Cloud API and set the env vars documented below. No call
 * site changes are needed.
 *
 * Twilio (set all to enable):  NOTIFY_PROVIDER=twilio
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+E.164 sender)
 * WhatsApp Cloud (set all):    NOTIFY_PROVIDER=whatsapp
 *   WHATSAPP_TOKEN, WHATSAPP_PHONE_ID
 */
import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"

export type NotifyChannel = "sms" | "whatsapp" | "email" | "inapp"

export interface NotifyInput {
  userId: string
  /** E.164 phone, e.g. +573001234567. If null, the attempt is logged skipped. */
  phone: string | null
  kind: string
  body: string
  orderId?: string | null
}

export type NotifyStatus = "sent" | "failed" | "skipped" | "queued"

function maskPhone(phone: string | null): string | null {
  if (!phone) return null
  if (phone.length <= 6) return phone
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`
}

function configuredProvider(): "twilio" | "whatsapp" | "none" {
  const p = (process.env.NOTIFY_PROVIDER ?? "").toLowerCase()
  if (
    p === "twilio" &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM
  )
    return "twilio"
  if (
    p === "whatsapp" &&
    process.env.WHATSAPP_TOKEN &&
    process.env.WHATSAPP_PHONE_ID
  )
    return "whatsapp"
  return "none"
}

async function sendViaProvider(
  provider: "twilio" | "whatsapp",
  to: string,
  body: string,
): Promise<{ ok: boolean; ref?: string; error?: string }> {
  try {
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID!
      const token = process.env.TWILIO_AUTH_TOKEN!
      const from = process.env.TWILIO_FROM!
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: to, From: from, Body: body }),
        },
      )
      const json = (await res.json()) as { sid?: string; message?: string }
      if (!res.ok) return { ok: false, error: json.message ?? `HTTP ${res.status}` }
      return { ok: true, ref: json.sid }
    }
    // WhatsApp Cloud API
    const phoneId = process.env.WHATSAPP_PHONE_ID!
    const wToken = process.env.WHATSAPP_TOKEN!
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${wToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "text",
          text: { body },
        }),
      },
    )
    const json = (await res.json()) as {
      messages?: { id: string }[]
      error?: { message: string }
    }
    if (!res.ok) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` }
    return { ok: true, ref: json.messages?.[0]?.id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "send error" }
  }
}

/**
 * Send (or log) a notification to the user. Never throws — notification failure
 * must never break the purchase flow.
 */
export async function notifyUser(
  input: NotifyInput,
): Promise<{ status: NotifyStatus; ref?: string }> {
  const provider = configuredProvider()
  const channel: NotifyChannel = provider === "whatsapp" ? "whatsapp" : "sms"

  let status: NotifyStatus
  let providerRef: string | undefined
  let error: string | undefined

  if (!input.phone) {
    status = "skipped"
    error = "no phone on file"
  } else if (provider === "none") {
    // Integration is ready; no provider configured. Record the intent so it is
    // visible and can be replayed once creds are added.
    status = "queued"
  } else {
    const sent = await sendViaProvider(provider, input.phone, input.body)
    status = sent.ok ? "sent" : "failed"
    providerRef = sent.ref
    error = sent.error
  }

  try {
    const admin = createAdminClient()
    await admin.from("notifications").insert({
      user_id: input.userId,
      channel,
      kind: input.kind,
      destination: maskPhone(input.phone),
      body: input.body,
      status,
      provider: provider === "none" ? "none" : provider,
      provider_ref: providerRef ?? null,
      error: error ?? null,
      order_id: input.orderId ?? null,
    })
  } catch {
    // Logging failure must not break the flow.
  }

  return { status, ref: providerRef }
}
