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

describe('lineKg (display helper from grams)', () => {
  it('bulk kg is qty × bag size', () => {
    expect(lineKg('bulk', 2, 50_000)).toBe(100)
  })
  it('packaged has no kg', () => {
    expect(lineKg('packaged', 5, null)).toBe(0)
  })
})

describe('suggestedTransferTargetQty', () => {
  it('converts source mass (g) into bags of the target Default Bag Size', () => {
    // 6 × 50 kg = 300_000 g → 12 × 25 kg bags
    expect(suggestedTransferTargetQty(300_000, 25_000)).toBe(12)
    expect(suggestedTransferTargetQty(250_000, 50_000)).toBe(5)
  })

  it('allows fractional bags when mass does not divide evenly', () => {
    expect(suggestedTransferTargetQty(250_000, 30_000)).toBeCloseTo(250_000 / 30_000)
  })

  it('returns null when source mass or default bag is missing/invalid', () => {
    expect(suggestedTransferTargetQty(0, 25_000)).toBeNull()
    expect(suggestedTransferTargetQty(-10, 25_000)).toBeNull()
    expect(suggestedTransferTargetQty(100_000, null)).toBeNull()
    expect(suggestedTransferTargetQty(100_000, 0)).toBeNull()
    expect(suggestedTransferTargetQty(100_000, -50_000)).toBeNull()
  })
})

describe('lineTotal (paise)', () => {
  it('bulk priced per quintal (100kg)', () => {
    // 2 × 50kg = 100kg = 1 quintal × ₹6000 = 600_000 paise
    expect(
      lineTotal({
        productType: 'bulk',
        qty: 2,
        bagSizeG: 50_000,
        quintalRate: 600_000,
        unitRate: null,
        isLoose: false
      })
    ).toBe(600_000)
  })
  it('loose bulk priced per kg', () => {
    expect(
      lineTotal({
        productType: 'bulk',
        qty: 10,
        bagSizeG: null,
        quintalRate: null,
        unitRate: 6_000,
        isLoose: true
      })
    ).toBe(60_000)
  })
  it('packaged priced per unit', () => {
    expect(
      lineTotal({
        productType: 'packaged',
        qty: 4,
        bagSizeG: null,
        quintalRate: null,
        unitRate: 4_500
      })
    ).toBe(18_000)
  })
})

describe('grandTotal (paise)', () => {
  it('sums lines plus loading plus additional', () => {
    expect(grandTotal([600_000, 18_000], 10_000, 5_000)).toBe(633_000)
  })
})

describe('computeLoadingCharge (paise, weight breakpoints)', () => {
  const breakpoints = [
    { maxMassG: 10_000, chargePaise: 0 },
    { maxMassG: 30_000, chargePaise: 1_000 },
    { maxMassG: null, chargePaise: 1_200 }
  ]

  it('picks tier from total mass in grams', () => {
    // 2 × 50kg = 100_000 g → above 30 → ₹12
    expect(computeLoadingCharge(100_000, breakpoints)).toBe(1_200)
  })

  it('returns 0 for empty mass or empty breakpoints', () => {
    expect(computeLoadingCharge(0, breakpoints)).toBe(0)
    expect(computeLoadingCharge(50_000, [])).toBe(0)
  })
})

describe('validateSale', () => {
  const products = new Map<number, LineProductLookup>([
    [1, { type: 'bulk', defaultBagSizeG: 50_000 }],
    [2, { type: 'packaged', defaultBagSizeG: null }]
  ])
  const bulkLine: SaleLineInput = {
    productId: 1,
    isLoose: false,
    bagSizeG: 50_000,
    quintalRate: 600_000,
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

describe('MoneyTxnSchema (RE/PA cash + UPI + discount paise)', () => {
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
      discountAmount: 25_000
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.discountAmount).toBe(25_000)
      expect(moneyRealized(result.data.cashCollected, result.data.upiCollected)).toBe(0)
      expect(
        moneyFace(result.data.cashCollected, result.data.upiCollected, result.data.discountAmount)
      ).toBe(25_000)
    }
  })

  it('accepts cash + UPI + discount and derives realized / face / %', () => {
    const result = MoneyTxnSchema.safeParse({
      ...base,
      cashCollected: 70_000,
      upiCollected: 20_000,
      discountAmount: 10_000
    })
    expect(result.success).toBe(true)
    if (result.success) {
      const { cashCollected: cash, upiCollected: upi, discountAmount: discount } = result.data
      expect(moneyRealized(cash, upi)).toBe(90_000)
      expect(moneyFace(cash, upi, discount)).toBe(100_000)
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
