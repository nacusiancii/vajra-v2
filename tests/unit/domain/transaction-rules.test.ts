import { describe, it, expect } from 'vitest'
import {
  computeLoadingCharge,
  grandTotal,
  lineKg,
  lineTotal,
  validateSale,
  type LineProductLookup
} from '@domain/transaction-rules'
import type { SaleLineInput } from '@domain/transaction'

describe('lineKg', () => {
  it('bulk kg is qty × bag size', () => {
    expect(lineKg('bulk', 2, 50)).toBe(100)
  })
  it('packaged has no kg', () => {
    expect(lineKg('packaged', 5, null)).toBe(0)
  })
})

describe('lineTotal', () => {
  it('bulk priced per quintal (100kg)', () => {
    // 2 × 50kg = 100kg = 1 quintal × ₹6000 = ₹6000
    expect(
      lineTotal({ productType: 'bulk', qty: 2, bagSizeKg: 50, quintalRate: 6000, unitRate: null })
    ).toBe(6000)
  })
  it('packaged priced per unit', () => {
    expect(
      lineTotal({ productType: 'packaged', qty: 4, bagSizeKg: null, quintalRate: null, unitRate: 45 })
    ).toBe(180)
  })
})

describe('grandTotal', () => {
  it('sums lines plus loading plus additional', () => {
    expect(grandTotal([6000, 180], 100, 50)).toBe(6330)
  })
})

describe('computeLoadingCharge', () => {
  it('charges per bag of each bulk line by bag type', () => {
    const charge = computeLoadingCharge(
      [
        { productType: 'bulk', bagSizeKg: 50, qty: 2 },
        { productType: 'bulk', bagSizeKg: 25, qty: 4 },
        { productType: 'packaged', bagSizeKg: null, qty: 10 }
      ],
      { 50: 20, 25: 10 }
    )
    expect(charge).toBe(2 * 20 + 4 * 10)
  })
})

describe('validateSale', () => {
  const products = new Map<number, LineProductLookup>([
    [1, { type: 'bulk', defaultBagSizeKg: 50 }],
    [2, { type: 'packaged', defaultBagSizeKg: null }]
  ])
  const bulkLine: SaleLineInput = { productId: 1, bagSizeKg: 50, quintalRate: 6000, unitRate: null, qty: 1 }

  it('rejects an empty cart', () => {
    expect(validateSale([], products, { mode: 'cash', hasCustomer: false, customerHasPhone: false, isWalkin: true })).toMatch(
      /at least one line/
    )
  })

  it('rejects a bulk line without a quintal rate', () => {
    const bad: SaleLineInput = { ...bulkLine, quintalRate: null }
    expect(validateSale([bad], products, { mode: 'cash', hasCustomer: false, customerHasPhone: false, isWalkin: true })).toMatch(
      /Quintal Rate/
    )
  })

  it('rejects a credit sale to a walk-in', () => {
    expect(
      validateSale([bulkLine], products, { mode: 'credit', hasCustomer: false, customerHasPhone: false, isWalkin: true })
    ).toMatch(/Customer Master/)
  })

  it('rejects a credit sale to a customer with no phone', () => {
    expect(
      validateSale([bulkLine], products, { mode: 'credit', hasCustomer: true, customerHasPhone: false, isWalkin: false })
    ).toMatch(/phone/)
  })

  it('accepts a valid cash sale', () => {
    expect(
      validateSale([bulkLine], products, { mode: 'cash', hasCustomer: false, customerHasPhone: false, isWalkin: true })
    ).toBeNull()
  })
})
