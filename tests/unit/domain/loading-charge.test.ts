/**
 * Loading Charge + bag-size pricing rules in integer paise / grams.
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
import { DEFAULT_SETTINGS } from '@domain/settings'
import { BAG_SIZES_G } from '@domain/types'

describe('computeLoadingCharge — core cases (paise)', () => {
  it('returns 0 for an empty cart', () => {
    expect(computeLoadingCharge([], { 25_000: 1_000, 50_000: 2_000 })).toBe(0)
  })

  it('returns 0 when rates are empty', () => {
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeG: 50_000, qty: 3 }], {})).toBe(0)
  })

  it('returns 0 when all rates are 0 (shipped defaults)', () => {
    expect(
      computeLoadingCharge(
        [{ productType: 'bulk', bagSizeG: 50_000, qty: 4 }],
        DEFAULT_SETTINGS.loadingChargePerBag
      )
    ).toBe(0)
  })

  it('charges one bag type only', () => {
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeG: 50_000, qty: 3 }], { 50_000: 1_500 })
    ).toBe(4_500)
  })

  it('sums multiple bulk lines with different bag types', () => {
    // 2×50 @ ₹20 + 4×25 @ ₹10 + 1×30 @ ₹12 = 92 rupees = 9200 paise
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeG: 50_000, qty: 2 },
          { productType: 'bulk', bagSizeG: 25_000, qty: 4 },
          { productType: 'bulk', bagSizeG: 30_000, qty: 1 }
        ],
        { 50_000: 2_000, 25_000: 1_000, 30_000: 1_200 }
      )
    ).toBe(9_200)
  })

  it('ignores packaged lines completely', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'packaged', bagSizeG: null, qty: 100 },
          { productType: 'packaged', bagSizeG: 50_000, qty: 5 }
        ],
        { 50_000: 9_900 }
      )
    ).toBe(0)
  })

  it('half bags charge half rate (rounded)', () => {
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeG: 50_000, qty: 0.5 }], { 50_000: 2_000 })
    ).toBe(1_000)
  })

  it('floating rupee rate stored as paise stays integer', () => {
    // ₹10.50/bag × 3 = ₹31.50 = 3150 paise
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeG: 50_000, qty: 3 }], { 50_000: 1_050 })
    ).toBe(3_150)
  })
})

describe('line pricing + loading composition (paise)', () => {
  it('grand total = lines + loading + additional', () => {
    // 2×50kg @ ₹6000/q = ₹6000; loading ₹40; additional ₹25 → ₹6065
    const goods = lineTotal({
      productType: 'bulk',
      qty: 2,
      bagSizeG: 50_000,
      quintalRate: 600_000,
      unitRate: null
    })
    const loading = computeLoadingCharge([{ productType: 'bulk', bagSizeG: 50_000, qty: 2 }], {
      50_000: 2_000
    })
    expect(goods).toBe(600_000)
    expect(loading).toBe(4_000)
    expect(grandTotal([goods], loading, 2_500)).toBe(606_500)
  })

  it('non-default bag size changes goods total AND loading rate key', () => {
    // 4 × 25kg = 100kg = 1 quintal @ ₹6000
    const goods = lineTotal({
      productType: 'bulk',
      qty: 4,
      bagSizeG: 25_000,
      quintalRate: 600_000,
      unitRate: null
    })
    const loading = computeLoadingCharge([{ productType: 'bulk', bagSizeG: 25_000, qty: 4 }], {
      25_000: 1_000,
      50_000: 2_000
    })
    expect(goods).toBe(600_000)
    expect(loading).toBe(4_000)
  })
})

describe('stock deltas in grams', () => {
  it('25kg against 50kg default is 25000 g not a float fraction', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 1,
        bagSizeG: 25_000,
        defaultBagSizeG: 50_000,
        direction: -1
      })
    ).toBe(-25_000)
  })

  it('30kg × 5 against 50kg default is exact 150000 g', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 5,
        bagSizeG: 30_000,
        defaultBagSizeG: 50_000,
        direction: -1
      })
    ).toBe(-150_000)
  })
})

describe('validateSale + bag membership', () => {
  const products = new Map<number, LineProductLookup>([
    [1, { type: 'bulk', defaultBagSizeG: 50_000 }],
    [2, { type: 'packaged', defaultBagSizeG: null }]
  ])

  it('accepts bulk with non-default bag size still in shop bag types', () => {
    const line: SaleLineInput = {
      productId: 1,
      bagSizeG: 25_000,
      quintalRate: 600_000,
      unitRate: null,
      qty: 1
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
})

describe('settings + bag types', () => {
  it('defaults use grams keys and zero paise rates', () => {
    expect([...DEFAULT_SETTINGS.bagTypes]).toEqual([...BAG_SIZES_G])
    expect([...BAG_SIZES_G]).toEqual([25_000, 30_000, 50_000])
    expect(DEFAULT_SETTINGS.loadingChargePerBag).toEqual({ 25_000: 0, 30_000: 0, 50_000: 0 })
  })

  it('isValidBagSizeG accepts shipped sizes', () => {
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
    expect(
      CreateProductSchema.safeParse({
        name: 'X',
        productGroupName: 'G',
        type: 'bulk',
        defaultBagSizeG: 40_000,
        nameTe: null,
        remarks: null
      }).success
    ).toBe(false)
  })
})
