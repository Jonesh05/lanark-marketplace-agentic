/**
 * Standalone amount conversion tests (no Next.js path aliases).
 * Validates wei math for sub-cent USDm purchases.
 */
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { parseUnits } from "viem"

const CUSD_DECIMALS = 18

function cusdToWei(amount) {
  const s = typeof amount === "number" ? amount.toFixed(18) : amount
  return parseUnits(s, CUSD_DECIMALS)
}

function productCusd(priceCents, currency, priceCusd) {
  if (priceCusd !== null && priceCusd !== undefined && priceCusd !== "") {
    const n = Number(priceCusd)
    if (Number.isFinite(n) && n > 0) return n
  }
  const major = (Number(priceCents) || 0) / 100
  const rate = currency === "COP" ? 4000 : 1
  return major / rate
}

function productUnitPriceWei(priceCents, currency, priceCusd) {
  if (priceCusd !== null && priceCusd !== undefined && String(priceCusd).trim() !== "") {
    const raw = String(priceCusd).trim()
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return cusdToWei(raw)
  }
  const human = productCusd(priceCents, currency, null)
  if (!Number.isFinite(human) || human <= 0) return BigInt(0)
  return cusdToWei(human)
}

function orderAmountWei(row) {
  return BigInt(String(row.total_cusd_wei ?? row.amount_cusd_wei ?? "0"))
}

describe("productUnitPriceWei", () => {
  const pass = [
    ["0.001 USDm", 0, "USD", "0.001", parseUnits("0.001", 18)],
    ["0.01 USDm", 0, "USD", "0.01", parseUnits("0.01", 18)],
    ["0.02 USDm", 0, "USD", "0.02", parseUnits("0.02", 18)],
    ["0.10 USDm", 0, "USD", "0.10", parseUnits("0.10", 18)],
    ["1 USDm", 0, "USD", "1", parseUnits("1", 18)],
    ["0.01 USD via cents", 1, "USD", null, parseUnits("0.01", 18)],
  ]

  for (const [label, cents, cur, pc, expected] of pass) {
    it(`PASS ${label}`, () => {
      const wei = productUnitPriceWei(cents, cur, pc)
      assert.ok(wei > BigInt(0))
      assert.equal(wei, expected)
    })
  }

  it("FAIL zero", () => {
    assert.equal(productUnitPriceWei(0, "USD", null), BigInt(0))
  })

  it("FAIL negative", () => {
    assert.equal(productUnitPriceWei(0, "USD", "-1"), BigInt(0))
  })

  it("FAIL NaN", () => {
    assert.equal(productUnitPriceWei(0, "USD", "bad"), BigInt(0))
  })
})

describe("prepareSettlement gate", () => {
  it("PASS 0.001 order total", () => {
    const wei = parseUnits("0.001", 18)
    assert.ok(orderAmountWei({ total_cusd_wei: wei.toString() }) > BigInt(0))
  })

  it("FAIL zero total (El total de la orden no es valido)", () => {
    assert.equal(orderAmountWei({ total_cusd_wei: "0" }), BigInt(0))
  })
})
