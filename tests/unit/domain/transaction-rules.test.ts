import { describe, it, expect } from 'vitest'
import {
  computeLoadingCharge,
  grandTotal,
  lineKg,
  lineTotal,
  MoneyTxnSchema,
  suggestedTransferTargetQty,
  validateSale,
  type LineProductLookup
} from '@domain/transaction-rules'
import {
  moneyDiscountPercent,
  moneyFace,
  moneyRealized,
  type SaleLineInput
} from '@domain/transaction'

describe('lineKg', () => {
  it('bulk kg is qty × bag size', () => {
    expect(lineKg('bulk', 2, 50)).toBe(100)
  })
  it('packaged has no kg', () => {
    expect(lineKg('packaged', 5, null)).toBe(0)
  })
})

describe('suggestedTransferTargetQty', () => {
  it('converts source kg into bags of the target Default Bag Size', () => {
    // glossary: 6 × 50 kg → 12 × 25 kg
    expect(suggestedTransferTargetQty(300, 25)).toBe(12)
    expect(suggestedTransferTargetQty(250, 50)).toBe(5)
  })

  it('allows fractional bags when kg does not divide evenly', () => {
    expect(suggestedTransferTargetQty(250, 30)).toBeCloseTo(250 / 30)
  })

  it('returns null when source kg or default bag is missing/invalid', () => {
    expect(suggestedTransferTargetQty(0, 25)).toBeNull()
    expect(suggestedTransferTargetQty(-10, 25)).toBeNull()
    expect(suggestedTransferTargetQty(100, null)).toBeNull()
    expect(suggestedTransferTargetQty(100, 0)).toBeNull()
    expect(suggestedTransferTargetQty(100, -50)).toBeNull()
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
      lineTotal({
        productType: 'packaged',
        qty: 4,
        bagSizeKg: null,
        quintalRate: null,
        unitRate: 45
      })
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

  it('returns 0 when not opted in / empty rates', () => {
    expect(computeLoadingCharge([{ productType: 'bulk', bagSizeKg: 50, qty: 2 }], {})).toBe(0)
  })

  it('missing bag-type rate contributes 0 for that line only', () => {
    expect(
      computeLoadingCharge(
        [
          { productType: 'bulk', bagSizeKg: 50, qty: 1 },
          { productType: 'bulk', bagSizeKg: 30, qty: 2 }
        ],
        { 50: 20 }
      )
    ).toBe(20)
  })
})

describe('validateSale', () => {
  const products = new Map<number, LineProductLookup>([
    [1, { type: 'bulk', defaultBagSizeKg: 50 }],
    [2, { type: 'packaged', defaultBagSizeKg: null }]
  ])
  const bulkLine: SaleLineInput = {
    productId: 1,
    bagSizeKg: 50,
    quintalRate: 6000,
    unitRate: null,
    qty: 1
  }

  it('rejects an empty cart', () => {
    expect(
      validateSale([], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toMatch(/at least one line/)
  })

  it('rejects a bulk line without a quintal rate', () => {
    const bad: SaleLineInput = { ...bulkLine, quintalRate: null }
    expect(
      validateSale([bad], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toMatch(/Quintal Rate/)
  })

  it('rejects a credit sale to a walk-in', () => {
    expect(
      validateSale([bulkLine], products, {
        mode: 'credit',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toMatch(/Customer Master/)
  })

  it('rejects a credit sale to a customer with no phone', () => {
    expect(
      validateSale([bulkLine], products, {
        mode: 'credit',
        hasCustomer: true,
        customerHasPhone: false,
        isWalkin: false
      })
    ).toMatch(/phone/)
  })

  it('accepts a valid cash sale', () => {
    expect(
      validateSale([bulkLine], products, {
        mode: 'cash',
        hasCustomer: false,
        customerHasPhone: false,
        isWalkin: true
      })
    ).toBeNull()
  })
})

describe('MoneyTxnSchema (RE/PA cash + UPI + discount ₹)', () => {
  const base = {
    customerId: 1,
    label: null,
    remarks: null
  }

  it('rejects all-zero cash, UPI, and discount', () => {
    const result = MoneyTxnSchema.safeParse({
      ...base,
      cashCollected: 0,
      upiCollected: 0,
      discountAmount: 0
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/cash, UPI, or a discount/i)
    }
  })

  it('accepts a pure write-off (discount only)', () => {
    const result = MoneyTxnSchema.safeParse({
      ...base,
      cashCollected: 0,
      upiCollected: 0,
      discountAmount: 250
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cashCollected).toBe(0)
      expect(result.data.upiCollected).toBe(0)
      expect(result.data.discountAmount).toBe(250)
      // total stored by the repo is realized only
      expect(moneyRealized(result.data.cashCollected, result.data.upiCollected)).toBe(0)
      expect(
        moneyFace(result.data.cashCollected, result.data.upiCollected, result.data.discountAmount)
      ).toBe(250)
    }
  })

  it('accepts cash + UPI + discount and derives realized / face / %', () => {
    const result = MoneyTxnSchema.safeParse({
      ...base,
      cashCollected: 700,
      upiCollected: 200,
      discountAmount: 100
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const { cashCollected: cash, upiCollected: upi, discountAmount: discount } = result.data
      expect(moneyRealized(cash, upi)).toBe(900)
      expect(moneyFace(cash, upi, discount)).toBe(1000)
      expect(moneyDiscountPercent(cash, upi, discount)).toBe(10)
    }
  })

  it('rejects negative money fields', () => {
    expect(
      MoneyTxnSchema.safeParse({
        ...base,
        cashCollected: -1,
        upiCollected: 0,
        discountAmount: 0
      }).success
    ).toBe(false)
  })
})
