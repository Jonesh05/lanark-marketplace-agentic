"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { User, ShieldCheck, History, ArrowRight, Store as StoreIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { shortAddress } from "@/lib/format"
import { PhoneField } from "@/components/ui/phone-field"
import { updateProfile, updateStore, updatePhone } from "@/app/actions/profile"
import type { Profile, Store } from "@/lib/types"

type AuditEntry = {
  id: string
  entity_type: string
  entity_id: string
  action: string
  changes: Record<string, { from: unknown; to: unknown }>
  created_at: string
}

export function ProfileSettings({
  profile,
  store,
  auditLog,
}: {
  profile: Profile
  store: Store | null
  auditLog: AuditEntry[]
}) {
  const [displayName, setDisplayName] = useState(profile.display_name ?? "")
  const [phone, setPhone] = useState<string | null>(profile.phone ?? null)
  const [phoneCountry, setPhoneCountry] = useState(profile.phone_country ?? "CO")
  const [storeName, setStoreName] = useState(store?.name ?? "")
  const [taxId, setTaxId] = useState(store?.tax_id ?? "")
  const [pending, startTransition] = useTransition()
  const [storePending, startStoreTransition] = useTransition()

  const isShopkeeper = profile.role === "shopkeeper"

  function handleIdentitySubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      // Persist phone first (typed + E.164 validated server-side), then the
      // display name. Role is locked server-side; we send it unchanged.
      const ph = await updatePhone({ phone, country: phoneCountry })
      if (!ph.ok) {
        toast.error(ph.error)
        return
      }
      const res = await updateProfile({
        role: profile.role,
        displayName: displayName.trim() || null,
      })
      if (!res.ok) toast.error(res.error)
      else toast.success("Profile updated.")
    })
  }

  function handleStoreSubmit(e: React.FormEvent) {
    e.preventDefault()
    startStoreTransition(async () => {
      const res = await updateStore({
        name: storeName.trim(),
        taxId: taxId.trim() || null,
      })
      if (!res.ok) toast.error(res.error)
      else toast.success(store ? "Store updated." : "Store created.")
    })
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2 border-b border-border/60 pb-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Profile settings
        </span>
        <h1 className="font-serif text-4xl tracking-tight">Your account</h1>
      </header>

      <form onSubmit={handleIdentitySubmit} className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium">Identity</h2>
          </div>

          <div className="flex flex-col gap-4 pl-7">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wallet" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Wallet address
              </Label>
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="block h-2 w-2 rounded-full bg-accent" />
                {profile.primary_address ? shortAddress(profile.primary_address) : "No wallet linked"}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="displayName" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Display name
              </Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={50}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Mobile number
              </Label>
              <PhoneField
                e164={profile.phone}
                defaultCountry={profile.phone_country ?? "CO"}
                onChange={(value, iso) => {
                  setPhone(value)
                  setPhoneCountry(iso)
                }}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                For purchase confirmations and abandoned-cart links (SMS). Default +57.
              </span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-medium">Role</h2>
          </div>

          <div className="flex flex-col gap-3 pl-7">
            <p className="text-sm text-muted-foreground">
              Your role is set when you first sign in and stays locked. It keeps the
              seller and client surfaces strictly separated.
            </p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-accent">
                <span className="block h-1.5 w-1.5 rounded-full bg-accent" />
                {isShopkeeper ? "Shopkeeper" : "Client"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                locked
              </span>
            </div>
          </div>
        </section>

        <Button type="submit" disabled={pending} className="h-11 self-end">
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </form>

      {isShopkeeper && (
        <form onSubmit={handleStoreSubmit} className="flex flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card/40 p-6">
            <div className="flex items-center gap-3">
              <StoreIcon className="h-4 w-4 text-accent" />
              <h2 className="text-sm font-medium">Store</h2>
            </div>

            <div className="flex flex-col gap-4 pl-7">
              <p className="text-sm text-muted-foreground">
                This is your brand — clients browse and find you by this name
                (e.g. "El Cafecito"). You can rename it anytime.
              </p>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="storeName" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Business name
                </Label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="El Cafecito"
                  maxLength={80}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="taxId" className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Tax ID (NIT/RUT) · optional
                </Label>
                <Input
                  id="taxId"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="900.123.456-7"
                  maxLength={40}
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  Simple KYC identifier, off-chain. Used for invoicing only.
                </span>
              </div>

              {store?.slug && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Storefront slug
                  </Label>
                  <span className="font-mono text-sm text-foreground">/?store={store.slug}</span>
                </div>
              )}
            </div>
          </section>

          <Button
            type="submit"
            disabled={storePending || storeName.trim().length < 2}
            className="h-11 self-end"
          >
            {storePending ? "Saving…" : store ? "Save store" : "Create store"}
          </Button>
        </form>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <History className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-medium">Activity log</h2>
        </div>

        {auditLog.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/30 px-6 py-10 text-center text-sm text-muted-foreground">
            No activity recorded yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40">
            {auditLog.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-accent" />
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm">
                    <span className="capitalize">{entry.action}</span> {entry.entity_type}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                  {Object.entries(entry.changes).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {Object.entries(entry.changes).slice(0, 3).map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 rounded border border-border/60 bg-muted/40 px-2 py-0.5 font-mono text-[10px]"
                        >
                          {key}
                          {val && typeof val === "object" && "to" in val && (
                            <>
                              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                              <span className="text-foreground">{String(val.to).slice(0, 20)}</span>
                            </>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
