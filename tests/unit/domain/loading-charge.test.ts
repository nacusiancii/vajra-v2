/**
 * Loading Charge weight-breakpoint rules in integer paise / grams.
 */
import { describe, it, expect } from 'vitest'
import {
  computeLoadingCharge,
  grandTotal,
  lineTotal,
  validateSale,
  type LineProductLookup
} from '@domain/transaction-rules'
import { lineStockDelta } from '@domain/transaction'
import type { SaleLineInput } from '@domain/transaction'
import { CreateProductSchema, isValidBagSizeG } from '@domain/product'
import { DEFAULT_LOADING_CHARGE, DEFAULT_SETTINGS, loadingChargeForKg } from '@domain/settings'
import { BAG_SIZES_G } from '@domain/types'

const defaultRules = DEFAULT_SETTINGS.loadingCharge

describe('loadingChargeForKg — breakpoint boundaries', () => {
  it('exactly 10 kg uses the ≤10 breakpoint (₹0)', () => {
    expect(loadingChargeForKg(10, defaultRules)).toBe(0)
  })

  it('just over 10 kg uses the ≤30 breakpoint (₹10)', () => {
    expect(loadingChargeForKg(10.001, defaultRules)).toBe(1_000)
  })

  it('exactly 30 kg uses the ≤30 breakpoint (₹10)', () => {
    expect(loadingChargeForKg(30, defaultRules)).toBe(1_000)
  })

  it('above 30 kg uses aboveLast (₹12)', () => {
    expect(loadingChargeForKg(30.001, defaultRules)).toBe(1_200)
    expect(loadingChargeForKg(50, defaultRules)).toBe(1_200)
  })

  it('returns 0 for non-positive weight', () => {
    expect(loadingChargeForKg(0, defaultRules)).toBe(0)
    expect(loadingChargeForKg(-5, defaultRules)).toBe(0)
  })

  it('is order-independent: picks the smallest qualifying upToKg', () => {
    // Reversed storage order must still map 15 kg → ≤30 band (₹10), not aboveLast.
    const reversed = {
      breakpoints: [
        { upToKg: 30, chargePaise: 1_000 },
        { upToKg: 10, chargePaise: 0 }
      ],
      aboveLastPaise: 1_200
    }
    expect(loadingChargeForKg(5, reversed)).toBe(0)
    expect(loadingChargeForKg(15, reversed)).toBe(1_000)
    expect(loadingChargeForKg(50, reversed)).toBe(1_200)
  })
})

describe('computeLoadingCharge — bag and loose parcels', () => {
  it('returns 0 for an empty cart', () => {
    expect(computeLoadingCharge([], defaultRules)).toBe(0)
  })

  it('charges each bag by bag weight (50 kg → ₹12)', () => {
    // 3 × 50kg bags → 3 × 1200 = 3600
    expect(computeLoadingCharge([{ isLoose: false, bagSizeG: 50_000, qty: 3 }], defaultRules)).toBe(
      3_600
    )
  })

  it('25 kg bags use ≤30 breakpoint (₹10 each)', () => {
    expect(computeLoadingCharge([{ isLoose: false, bagSizeG: 25_000, qty: 4 }], defaultRules)).toBe(
      4_000
    )
  })

  it('sums multiple bag lines with different weights', () => {
    // 2×50 @ ₹12 + 4×25 @ ₹10 + 1×30 @ ₹10 = 24+40+10 = 74 rupees
    expect(
      computeLoadingCharge(
        [
          { isLoose: false, bagSizeG: 50_000, qty: 2 },
          { isLoose: false, bagSizeG: 25_000, qty: 4 },
          { isLoose: false, bagSizeG: 30_000, qty: 1 }
        ],
        defaultRules
      )
    ).toBe(7_400)
  })

  it('Loose line is one parcel charged by total kg', () => {
    // 15 kg loose → ≤30 → ₹10
    expect(computeLoadingCharge([{ isLoose: true, bagSizeG: null, qty: 15 }], defaultRules)).toBe(
      1_000
    )
    // 5 kg → ≤10 → ₹0
    expect(computeLoadingCharge([{ isLoose: true, bagSizeG: null, qty: 5 }], defaultRules)).toBe(0)
    // 40 kg → above → ₹12
    expect(computeLoadingCharge([{ isLoose: true, bagSizeG: null, qty: 40 }], defaultRules)).toBe(
      1_200
    )
  })

  it('half bags charge half the per-bag rate (rounded)', () => {
    // 0.5 × 50kg bag @ ₹12 = ₹6 = 600 paise
    expect(
      computeLoadingCharge([{ isLoose: false, bagSizeG: 50_000, qty: 0.5 }], defaultRules)
    ).toBe(600)
  })
})

describe('line pricing + loading composition (paise)', () => {
  it('grand total = lines + loading + additional', () => {
    // 2×50kg @ ₹6000/q = ₹6000; loading 2×₹12; additional ₹25 → ₹6050
    const goods = lineTotal({
      isLoose: false,
      qty: 2,
      bagSizeG: 50_000,
      quintalRate: 600_000,
      perKgRate: null
    })
    const loading = computeLoadingCharge(
      [{ isLoose: false, bagSizeG: 50_000, qty: 2 }],
      defaultRules
    )
    expect(goods).toBe(600_000)
    expect(loading).toBe(2_400)
    expect(grandTotal([goods], loading, 2_500)).toBe(604_900)
  })

  it('loose line total + loading', () => {
    // 12.5 kg × ₹60/kg = ₹750; loading ≤30 → ₹10
    const goods = lineTotal({
      isLoose: true,
      qty: 12.5,
      bagSizeG: null,
      quintalRate: null,
      perKgRate: 6_000
    })
    const loading = computeLoadingCharge(
      [{ isLoose: true, bagSizeG: null, qty: 12.5 }],
      defaultRules
    )
    expect(goods).toBe(75_000)
    expect(loading).toBe(1_000)
  })
})

describe('stock deltas in grams', () => {
  it('25kg against 50kg default is 25000 g', () => {
    expect(
      lineStockDelta({
        isLoose: false,
        qty: 1,
        bagSizeG: 25_000,
        direction: -1
      })
    ).toBe(-25_000)
  })

  it('loose 2.5 kg is 2500 g', () => {
    expect(
      lineStockDelta({
        isLoose: true,
        qty: 2.5,
        bagSizeG: null,
        direction: -1
      })
    ).toBe(-2_500)
  })
})

describe('validateSale + bag membership', () => {
  const products = new Map<number, LineProductLookup>([[1, { defaultBagSizeG: 50_000 }]])

  it('accepts bulk with non-default bag size', () => {
    const line: SaleLineInput = {
      productId: 1,
      isLoose: false,
      bagSizeG: 25_000,
      quintalRate: 600_000,
      perKgRate: null,
      qty: 1
    }
    expect(
      validateSale([line], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true,
        maxLineItems: DEFAULT_SETTINGS.maxLineItems
      })
    ).toBeNull()
  })
})

describe('settings + bag types', () => {
  it('defaults use weight breakpoints', () => {
    expect([...DEFAULT_SETTINGS.bagTypes]).toEqual([...BAG_SIZES_G])
    expect(DEFAULT_SETTINGS.loadingCharge).toEqual(DEFAULT_LOADING_CHARGE)
    expect(DEFAULT_LOADING_CHARGE.breakpoints).toEqual([
      { upToKg: 10, chargePaise: 0 },
      { upToKg: 30, chargePaise: 1_000 }
    ])
    expect(DEFAULT_LOADING_CHARGE.aboveLastPaise).toBe(1_200)
  })

  it('isValidBagSizeG accepts shipped sizes', () => {
    expect(isValidBagSizeG(25_000)).toBe(true)
    expect(isValidBagSizeG(40_000)).toBe(false)
  })

  it('CreateProductSchema requires valid bag grams', () => {
    expect(
      CreateProductSchema.safeParse({
        name: 'X',
        productGroupName: 'G',
        defaultBagSizeG: 50_000,
        nameTe: null,
        remarks: null
      }).success
    ).toBe(true)
    expect(
      CreateProductSchema.safeParse({
        name: 'X',
        productGroupName: 'G',
        defaultBagSizeG: 40_000,
        nameTe: null,
        remarks: null
      }).success
    ).toBe(false)
  })
})
