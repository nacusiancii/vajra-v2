/**
 * Stress tests for Loading Charge + bag-size pricing rules.
 * Tries to break computeLoadingCharge, line totals, grand total, and stock deltas
 * with mixed Bag Types, fractional qty, missing rates, and packaged lines.
 */
import { describe, it, expect } from 'vitest'
import {
  computeLoadingCharge,
  grandTotal,
  lineKg,
  lineTotal,
  validateSale,
  type LineProductLookup
} from '@domain/transaction-rules'
import { lineStockDelta } from '@domain/transaction'
import type { SaleLineInput } from '@domain/transaction'
import { CreateProductSchema, isValidBagSize } from '@domain/product'
import { DEFAULT_SETTINGS } from '@domain/settings'
import { BAG_SIZES } from '@domain/types'

describe('computeLoadingCharge — core cases', () => {
  it('returns 0 for an empty cart', () => {
    expect(computeLoadingCharge([], { 25: 10, 50: 20 })).toBe(0)
  })

  it('returns 0 when rates are empty (opt-in with no configured rates)', () => {
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 3 }], {})).toBe(0)
  })

  it('returns 0 when all rates are 0 (shipped defaults)', () => {
    expect(
      computeLoadingCharge(
        [{ productType: 'bulk', bagSizeKg: 50, qty: 4 }],
        DEFAULT_SETTINGS.loadingChargePerBag
      )
    ).toBe(0)
  })

  it('charges one bag type only', () => {
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 3 }], { 50: 15 })).toBe(
      45
    )
  })

  it('sums multiple bulk lines with different bag types', () => {
    // 2×50 @ ₹20 + 4×25 @ ₹10 + 1×30 @ ₹12 = 40 + 40 + 12 = 92
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeKg: 50, qty: 2 },
          { productType: 'bulk', bagSizeKg: 25, qty: 4 },
          { productType: 'bulk', bagSizeKg: 30, qty: 1 }
        ],
        { 50: 20, 25: 10, 30: 12 }
      )
    ).toBe(92)
  })

  it('ignores packaged lines completely', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'packaged', bagSizeKg: null, qty: 100 },
          { productType: 'packaged', bagSizeKg: 50, qty: 5 } // nonsense bag on packaged
        ],
        { 50: 99 }
      )
    ).toBe(0)
  })

  it('only charges bulk lines in a mixed cart', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeKg: 50, qty: 2 },
          { productType: 'packaged', bagSizeKg: null, qty: 10 }
        ],
        { 50: 25 }
      )
    ).toBe(50)
  })
})

describe('computeLoadingCharge — edge / break cases', () => {
  it('missing rate for a bag size falls back to 0 (does not throw)', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeKg: 50, qty: 2 },
          { productType: 'bulk', bagSizeKg: 25, qty: 3 }
        ],
        { 50: 20 } // 25 missing
      )
    ).toBe(40)
  })

  it('skips bulk lines with null bag size', () => {
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeKg: null, qty: 5 }], { 50: 20 })
    ).toBe(0)
  })

  it('skips bulk lines with bagSizeKg 0 (falsy)', () => {
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 0, qty: 5 }], { 0: 100 })).toBe(
      0
    )
  })

  it('charges fractional qty (half bags get half loading)', () => {
    // UI allows step 0.5 — is half-bag loading intentional?
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 0.5 }], { 50: 20 })
    ).toBe(10)
  })

  it('charges fractional qty that is not half', () => {
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 25, qty: 1.5 }], { 25: 10 })
    ).toBe(15)
  })

  it('qty 0 contributes nothing', () => {
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 0 }], { 50: 20 })).toBe(
      0
    )
  })

  it('negative qty produces negative loading (no guard)', () => {
    // Documents current behavior — validation should block this before finish.
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: -2 }], { 50: 20 })
    ).toBe(-40)
  })

  it('handles a custom bag size not in shipped BAG_SIZES (e.g. 40 kg)', () => {
    // Settings UI can add 40 kg; product Default Bag Size cannot use it.
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 40, qty: 3 }], { 40: 18 })).toBe(
      54
    )
  })

  it('handles very large qty without precision blow-up for whole rupees', () => {
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 10_000 }], { 50: 20 })
    ).toBe(200_000)
  })

  it('rate of 0 for one size, nonzero for another', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeKg: 50, qty: 5 },
          { productType: 'bulk', bagSizeKg: 25, qty: 5 }
        ],
        { 50: 0, 25: 8 }
      )
    ).toBe(40)
  })

  it('aggregates same bag type across separate lines', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeKg: 50, qty: 1 },
          { productType: 'bulk', bagSizeKg: 50, qty: 2 }
        ],
        { 50: 10 }
      )
    ).toBe(30)
  })

  it('floating rate × qty can produce float total (not rounded)', () => {
    // 3 × 10.5 = 31.5 — no Math.round in domain
    expect(
      computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 3 }], { 50: 10.5 })
    ).toBe(31.5)
  })
})

describe('line pricing + loading composition (Sale total math)', () => {
  it('grand total = lines + loading + additional', () => {
    // 2×50kg @ ₹6000/q = ₹6000 goods; loading ₹40; additional ₹25 → ₹6065
    const goods = lineTotal({
      productType: 'bulk',
      qty: 2,
      bagSizeKg: 50,
      quintalRate: 6000,
      unitRate: null
    })
    const loading = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 2 }], {
      50: 20
    })
    expect(goods).toBe(6000)
    expect(loading).toBe(40)
    expect(grandTotal([goods], loading, 25)).toBe(6065)
  })

  it('non-default bag size changes goods total AND loading rate key', () => {
    // Product default is often 50kg; selling 25kg bags: 4 × 25 = 100kg = 1 quintal
    const goods = lineTotal({
      productType: 'bulk',
      qty: 4,
      bagSizeKg: 25,
      quintalRate: 6000,
      unitRate: null
    })
    const loading = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 25, qty: 4 }], {
      25: 10,
      50: 20
    })
    expect(goods).toBe(6000)
    expect(loading).toBe(40) // 4 × ₹10, not 4 × ₹20
    expect(grandTotal([goods], loading, 0)).toBe(6040)
  })

  it('30 kg bag type is first-class for pricing and loading', () => {
    // 10 × 30kg = 300kg = 3 quintals × 5000 = 15000
    const goods = lineTotal({
      productType: 'bulk',
      qty: 10,
      bagSizeKg: 30,
      quintalRate: 5000,
      unitRate: null
    })
    const loading = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 30, qty: 10 }], {
      30: 12
    })
    expect(goods).toBe(15_000)
    expect(loading).toBe(120)
    expect(grandTotal([goods], loading, 0)).toBe(15_120)
  })

  it('opt-out of loading (charge 0) does not change goods total', () => {
    const goods = [
      lineTotal({
        productType: 'bulk',
        qty: 2,
        bagSizeKg: 50,
        quintalRate: 6000,
        unitRate: null
      })
    ]
    expect(grandTotal(goods, 0, 0)).toBe(6000)
  })

  it('mixed bulk bag sizes: goods by weight, loading by bag count × type', () => {
    // Line A: 2 × 50kg = 100kg → 1q × 8000 = 8000; loading 2×20 = 40
    // Line B: 2 × 25kg = 50kg  → 0.5q × 8000 = 4000; loading 2×10 = 20
    const a = lineTotal({
      productType: 'bulk',
      qty: 2,
      bagSizeKg: 50,
      quintalRate: 8000,
      unitRate: null
    })
    const b = lineTotal({
      productType: 'bulk',
      qty: 2,
      bagSizeKg: 25,
      quintalRate: 8000,
      unitRate: null
    })
    const loading = computeLoadingCharge(
      [
        { productType: 'bulk', bagSizeKg: 50, qty: 2 },
        { productType: 'bulk', bagSizeKg: 25, qty: 2 }
      ],
      { 50: 20, 25: 10 }
    )
    expect(a).toBe(8000)
    expect(b).toBe(4000)
    expect(loading).toBe(60)
    expect(grandTotal([a, b], loading, 0)).toBe(12_060)
  })

  it('packaged goods + bulk loading only on bulk portion', () => {
    const bulk = lineTotal({
      productType: 'bulk',
      qty: 1,
      bagSizeKg: 50,
      quintalRate: 6000,
      unitRate: null
    })
    const pack = lineTotal({
      productType: 'packaged',
      qty: 4,
      bagSizeKg: null,
      quintalRate: null,
      unitRate: 50
    })
    const loading = computeLoadingCharge(
      [
        { productType: 'bulk', bagSizeKg: 50, qty: 1 },
        { productType: 'packaged', bagSizeKg: null, qty: 4 }
      ],
      { 50: 20 }
    )
    expect(bulk).toBe(3000) // 50kg = 0.5 quintal
    expect(pack).toBe(200)
    expect(loading).toBe(20)
    expect(grandTotal([bulk, pack], loading, 0)).toBe(3220)
  })
})

describe('stock delta vs loading — loading must not affect stock', () => {
  it('stock delta depends only on bag sizes, not on loading rates', () => {
    const delta = lineStockDelta({
      productType: 'bulk',
      qty: 4,
      bagSizeKg: 25,
      defaultBagSizeKg: 50,
      direction: -1
    })
    // 4 × (25/50) = 2 default bags out
    expect(delta).toBe(-2)

    // Loading is independent money
    const loading = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 25, qty: 4 }], {
      25: 10
    })
    expect(loading).toBe(40)
  })

  it('same kg, different bag splits: same goods kg, different bag count loading, different stock', () => {
    // 100 kg sold either as 2×50 or 4×25
    expect(lineKg('bulk', 2, 50)).toBe(100)
    expect(lineKg('bulk', 4, 25)).toBe(100)

    const goods2x50 = lineTotal({
      productType: 'bulk',
      qty: 2,
      bagSizeKg: 50,
      quintalRate: 6000,
      unitRate: null
    })
    const goods4x25 = lineTotal({
      productType: 'bulk',
      qty: 4,
      bagSizeKg: 25,
      quintalRate: 6000,
      unitRate: null
    })
    expect(goods2x50).toBe(goods4x25)

    const load2x50 = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 2 }], {
      50: 20,
      25: 10
    })
    const load4x25 = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 25, qty: 4 }], {
      50: 20,
      25: 10
    })
    // Same weight, different bag counts → different loading (shop charges per bag)
    expect(load2x50).toBe(40)
    expect(load4x25).toBe(40) // rates chosen so equal; change rates to diverge

    // With uneven rates, loading diverges for same kg
    const load4x25_cheap = computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 25, qty: 4 }], {
      50: 20,
      25: 5
    })
    expect(load4x25_cheap).toBe(20)
    expect(load4x25_cheap).not.toBe(load2x50)

    // Stock in default-50 units: both move 2 units
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 2,
        bagSizeKg: 50,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-2)
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 4,
        bagSizeKg: 25,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-2)
  })

  it('selling 30kg bags from a 50kg default product fractions stock', () => {
    // 5 × 30/50 = 3 default bags
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 5,
        bagSizeKg: 30,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-3)
  })

  it('custom 40kg bag against 50kg default is fractional stock', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 5,
        bagSizeKg: 40,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-4) // 5 × 0.8
  })
})

describe('validateSale still allows lines that would yield zero loading', () => {
  const products = new Map<number, LineProductLookup>([
    [1, { type: 'bulk', defaultBagSizeKg: 50 }],
    [2, { type: 'packaged', defaultBagSizeKg: null }]
  ])

  it('valid bulk sale without requiring bag size to match default', () => {
    const line: SaleLineInput = {
      productId: 1,
      bagSizeKg: 25, // non-default
      quintalRate: 6000,
      unitRate: null,
      qty: 2
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

  it('rejects bulk without bag type (loading would also skip the line)', () => {
    const line: SaleLineInput = {
      productId: 1,
      bagSizeKg: null,
      quintalRate: 6000,
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
    ).toMatch(/Bag Type/)
  })

  it('does not reject unknown bag sizes (e.g. 40 kg) at validation layer', () => {
    // Documents gap: validateSale does not check settings.bagTypes membership
    const line: SaleLineInput = {
      productId: 1,
      bagSizeKg: 40,
      quintalRate: 6000,
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

describe('product bag-size validation gaps (known breaks)', () => {
  it('CreateProductSchema currently accepts non-shipped bag sizes (e.g. 40)', () => {
    // Gap: only nullability is refined; isValidBagSize is unused on create
    const result = CreateProductSchema.safeParse({
      name: 'Odd Bag Dal',
      productGroupName: 'Dal',
      type: 'bulk',
      defaultBagSizeKg: 40,
      nameTe: null,
      remarks: null
    })
    // This documents current behavior — DB CHECK would still reject 40
    expect(result.success).toBe(true)
  })

  it('isValidBagSize rejects 40 even though Settings can add it', () => {
    expect(isValidBagSize(40)).toBe(false)
  })

  it('isValidBagSize rejects 0 and negative', () => {
    expect(isValidBagSize(0)).toBe(false)
    expect(isValidBagSize(-25)).toBe(false)
  })

  it('shipped bag sizes align between types and defaults', () => {
    expect([...DEFAULT_SETTINGS.bagTypes]).toEqual([...BAG_SIZES])
    expect([...BAG_SIZES]).toEqual([25, 30, 50])
    expect(DEFAULT_SETTINGS.loadingChargePerBag).toEqual({ 25: 0, 30: 0, 50: 0 })
  })
})
