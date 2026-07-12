/**
 * Loading Charge (weight breakpoints) + loose bulk pricing in integer paise / grams.
 */
import { describe, it, expect } from 'vitest'
import {
  cartBulkMassG,
  computeLoadingCharge,
  computeLoadingChargeForLines,
  grandTotal,
  lineTotal,
  validateSale,
  type LineProductLookup
} from '@domain/transaction-rules'
import { lineStockDelta } from '@domain/transaction'
import type { SaleLineInput } from '@domain/transaction'
import { CreateProductSchema, isValidBagSizeG } from '@domain/product'
import { DEFAULT_LOADING_BREAKPOINTS, DEFAULT_SETTINGS } from '@domain/settings'
import { BAG_SIZES_G } from '@domain/types'

describe('computeLoadingCharge — weight breakpoints (paise)', () => {
  const defaults = DEFAULT_LOADING_BREAKPOINTS

  it('returns 0 for zero mass', () => {
    expect(computeLoadingCharge(0, defaults)).toBe(0)
  })

  it('returns 0 for empty breakpoints', () => {
    expect(computeLoadingCharge(50_000, [])).toBe(0)
  })

  it('≤10 kg → ₹0 (shipped default)', () => {
    expect(computeLoadingCharge(10_000, defaults)).toBe(0)
    expect(computeLoadingCharge(5_000, defaults)).toBe(0)
  })

  it('≤30 kg → ₹10 (shipped default)', () => {
    expect(computeLoadingCharge(10_001, defaults)).toBe(1_000)
    expect(computeLoadingCharge(30_000, defaults)).toBe(1_000)
  })

  it('above 30 kg → ₹12 (shipped default)', () => {
    expect(computeLoadingCharge(30_001, defaults)).toBe(1_200)
    expect(computeLoadingCharge(100_000, defaults)).toBe(1_200)
  })

  it('charges from cart bulk mass (bags + loose), ignores packaged', () => {
    // 1 × 50kg bag + 5 kg loose = 55 kg → ₹12
    const mass = cartBulkMassG([
      { productType: 'bulk', bagSizeG: 50_000, qty: 1, isLoose: false },
      { productType: 'bulk', bagSizeG: null, qty: 5, isLoose: true },
      { productType: 'packaged', bagSizeG: null, qty: 100 }
    ])
    expect(mass).toBe(55_000)
    expect(
      computeLoadingChargeForLines(
        [
          { productType: 'bulk', bagSizeG: 50_000, qty: 1, isLoose: false },
          { productType: 'bulk', bagSizeG: null, qty: 5, isLoose: true },
          { productType: 'packaged', bagSizeG: null, qty: 100 }
        ],
        defaults
      )
    ).toBe(1_200)
  })
})

describe('loose bulk pricing (paise)', () => {
  it('line total = kg × price/kg', () => {
    // 12.5 kg × ₹60/kg = ₹750 = 75_000 paise
    expect(
      lineTotal({
        productType: 'bulk',
        qty: 12.5,
        bagSizeG: null,
        quintalRate: null,
        unitRate: 6_000,
        isLoose: true
      })
    ).toBe(75_000)
  })

  it('stock delta is grams for loose kg', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 12.5,
        bagSizeG: null,
        defaultBagSizeG: 50_000,
        direction: -1,
        isLoose: true
      })
    ).toBe(-12_500)
  })

  it('grand total = loose goods + loading + additional', () => {
    const goods = lineTotal({
      productType: 'bulk',
      qty: 25,
      bagSizeG: null,
      quintalRate: null,
      unitRate: 6_000,
      isLoose: true
    })
    // 25 kg → ≤30 → ₹10 loading
    const loading = computeLoadingCharge(25_000, DEFAULT_LOADING_BREAKPOINTS)
    expect(goods).toBe(150_000)
    expect(loading).toBe(1_000)
    expect(grandTotal([goods], loading, 2_500)).toBe(153_500)
  })
})

describe('validateSale — loose lines', () => {
  const products = new Map<number, LineProductLookup>([
    [1, { type: 'bulk', defaultBagSizeG: 50_000 }],
    [2, { type: 'packaged', defaultBagSizeG: null }]
  ])

  it('accepts loose bulk with kg qty and ₹/kg', () => {
    const line: SaleLineInput = {
      productId: 1,
      isLoose: true,
      bagSizeG: null,
      quintalRate: null,
      unitRate: 6_000,
      qty: 12
    }
    expect(
      validateSale([line], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toBeNull()
  })

  it('rejects loose qty outside 1–50 kg', () => {
    const low: SaleLineInput = {
      productId: 1,
      isLoose: true,
      bagSizeG: null,
      quintalRate: null,
      unitRate: 6_000,
      qty: 0.5
    }
    expect(
      validateSale([low], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toMatch(/1 and 50/)
    const high: SaleLineInput = { ...low, qty: 51 }
    expect(
      validateSale([high], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toMatch(/1 and 50/)
  })
})

describe('settings defaults', () => {
  it('ships weight breakpoints, not per-bag rates', () => {
    expect(DEFAULT_SETTINGS.loadingChargeBreakpoints).toEqual(DEFAULT_LOADING_BREAKPOINTS)
    expect(DEFAULT_SETTINGS.loadingChargeBreakpoints[0]).toEqual({
      maxMassG: 10_000,
      chargePaise: 0
    })
    expect(DEFAULT_SETTINGS.loadingChargeBreakpoints[1]).toEqual({
      maxMassG: 30_000,
      chargePaise: 1_000
    })
    expect(DEFAULT_SETTINGS.loadingChargeBreakpoints[2]).toEqual({
      maxMassG: null,
      chargePaise: 1_200
    })
  })

  it('Default Bag Size constants still cover product master', () => {
    expect([...BAG_SIZES_G]).toEqual([25_000, 30_000, 50_000])
    expect(isValidBagSizeG(25_000)).toBe(true)
    expect(isValidBagSizeG(40_000)).toBe(false)
  })

  it('CreateProductSchema requires valid bag grams for bulk', () => {
    expect(
      CreateProductSchema.safeParse({
        name: 'X',
        productGroupName: 'G',
        type: 'bulk',
        defaultBagSizeG: 50_000,
        nameTe: null,
        remarks: null
      }).success
    ).toBe(true)
  })
})
