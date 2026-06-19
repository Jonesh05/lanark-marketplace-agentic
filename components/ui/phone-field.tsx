"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type Country = { iso: string; name: string; dial: string }

// LATAM-first country set; default Colombia (+57). Extend as markets open.
export const COUNTRIES: Country[] = [
  { iso: "CO", name: "Colombia", dial: "+57" },
  { iso: "MX", name: "México", dial: "+52" },
  { iso: "AR", name: "Argentina", dial: "+54" },
  { iso: "PE", name: "Perú", dial: "+51" },
  { iso: "CL", name: "Chile", dial: "+56" },
  { iso: "EC", name: "Ecuador", dial: "+593" },
  { iso: "VE", name: "Venezuela", dial: "+58" },
  { iso: "BR", name: "Brasil", dial: "+55" },
  { iso: "PA", name: "Panamá", dial: "+507" },
  { iso: "CR", name: "Costa Rica", dial: "+506" },
  { iso: "GT", name: "Guatemala", dial: "+502" },
  { iso: "BO", name: "Bolivia", dial: "+591" },
  { iso: "PY", name: "Paraguay", dial: "+595" },
  { iso: "UY", name: "Uruguay", dial: "+598" },
  { iso: "DO", name: "Rep. Dominicana", dial: "+1" },
  { iso: "US", name: "Estados Unidos", dial: "+1" },
  { iso: "ES", name: "España", dial: "+34" },
]

// ISO 3166-1 alpha-2 -> regional-indicator flag emoji (no asset/library needed).
function isoToFlag(iso: string): string {
  if (!/^[A-Za-z]{2}$/.test(iso)) return "\u{1F3F3}"
  const base = 0x1f1e6
  const up = iso.toUpperCase()
  return String.fromCodePoint(
    base + up.charCodeAt(0) - 65,
    base + up.charCodeAt(1) - 65,
  )
}

function dialFor(iso: string): string {
  return (COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0]).dial
}

/**
 * Phone capture with a country-code dropdown (flag + dial code) and a national
 * number input. Emits an E.164 string (or null when empty) plus the ISO code.
 * Default country is Colombia (+57).
 */
export function PhoneField({
  e164,
  defaultCountry = "CO",
  onChange,
  id = "phone",
}: {
  e164?: string | null
  defaultCountry?: string
  onChange: (e164: string | null, iso: string) => void
  id?: string
}) {
  const initialIso = COUNTRIES.some((c) => c.iso === defaultCountry)
    ? defaultCountry
    : "CO"

  const [iso, setIso] = useState(initialIso)
  const [national, setNational] = useState(() => {
    if (!e164) return ""
    const dial = dialFor(initialIso)
    return e164.startsWith(dial) ? e164.slice(dial.length) : e164.replace(/^\+/, "")
  })

  const country = useMemo(
    () => COUNTRIES.find((c) => c.iso === iso) ?? COUNTRIES[0],
    [iso],
  )

  function emit(nextIso: string, nextNational: string) {
    const dial = dialFor(nextIso)
    const digits = nextNational.replace(/\D/g, "")
    onChange(digits ? `${dial}${digits}` : null, nextIso)
  }

  return (
    <div className="flex gap-2">
      <Select
        value={iso}
        onValueChange={(v) => {
          setIso(v)
          emit(v, national)
        }}
      >
        <SelectTrigger className="w-[7.5rem] shrink-0" aria-label="Country code">
          <SelectValue>
            <span className="flex items-center gap-1.5">
              <span className="text-base leading-none">{isoToFlag(country.iso)}</span>
              <span className="font-mono text-xs">{country.dial}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.iso} value={c.iso}>
              <span className="flex items-center gap-2">
                <span className="text-base leading-none">{isoToFlag(c.iso)}</span>
                <span className="text-sm">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{c.dial}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="300 123 4567"
        value={national}
        onChange={(e) => {
          setNational(e.target.value)
          emit(iso, e.target.value)
        }}
        maxLength={15}
      />
    </div>
  )
}
