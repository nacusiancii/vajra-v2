import { describe, it, expect } from 'vitest'
import {
  computeLoadingCharge,
  grandTotal,
  lineKg,
  lineTotal,
  maxLineItemsExceededMessage,
  MoneyTxnSchema,
  SaleWriteSchema,
  suggestedTransferTargetQty,
  validatePurchase,
  validateSale,
  type LineProductLookup,
  type SaleValidationContext
} from '@domain/transaction-rules'
import {
  moneyDiscountPercent,
  moneyFace,
  moneyRealized,
  type SaleLineInput
} from '@domain/transaction'
import { DEFAULT_SETTINGS } from '@domain/settings'

const cashCtx = (over: Partial<SaleValidationContext> = {}): SaleValidationContext => ({
  mode: 'cash',
  hasCustomer: false,
  customerHasPhone: false,
  isWalkin: true,
  maxLineItems: DEFAULT_SETTINGS.maxLineItems,
  ...over
})

describe('lineKg (display helper from grams)', () => {
  it('bag line kg is qty × bag size', () => {
    expect(lineKg({ isLoose: false, qty: 2, bagSizeG: 50_000 })).toBe(100)
  })
  it('loose line kg is the entered qty', () => {
    expect(lineKg({ isLoose: true, qty: 12.5, bagSizeG: null })).toBe(12.5)
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
  it('bag priced per quintal (100kg)', () => {
    // 2 × 50kg = 100kg = 1 quintal × ₹6000 = 600_000 paise
    expect(
      lineTotal({
        isLoose: false,
        qty: 2,
        bagSizeG: 50_000,
        quintalRate: 600_000,
        perKgRate: null
      })
    ).toBe(600_000)
  })

  it('loose priced per kg with half-away rounding', () => {
    // 2.5 kg × ₹60.005/kg → intermediate may need rounding; use clean numbers
    expect(
      lineTotal({
        isLoose: true,
        qty: 2.5,
        bagSizeG: null,
        quintalRate: null,
        perKgRate: 6_000
      })
    ).toBe(15_000)
  })
})

describe('grandTotal (paise)', () => {
  it('sums lines plus loading plus additional', () => {
    expect(grandTotal([600_000, 15_000], 10_000, 5_000)).toBe(630_000)
  })
})

describe('computeLoadingCharge (weight breakpoints)', () => {
  const rules = DEFAULT_SETTINGS.loadingCharge

  it('charges bags by weight and loose by total kg', () => {
    const charge = computeLoadingCharge(
      [
        { isLoose: false, bagSizeG: 50_000, qty: 2 }, // 2 × ₹12
        { isLoose: false, bagSizeG: 25_000, qty: 4 }, // 4 × ₹10
        { isLoose: true, bagSizeG: null, qty: 8 } // ≤10 → ₹0
      ],
      rules
    )
    expect(charge).toBe(2 * 1_200 + 4 * 1_000 + 0)
  })

  it('returns 0 when all parcels fall in zero-charge band', () => {
    expect(computeLoadingCharge([{ isLoose: true, bagSizeG: null, qty: 5 }], rules)).toBe(0)
  })
})

describe('validateSale', () => {
  const products = new Map<number, LineProductLookup>([[1, { defaultBagSizeG: 50_000 }]])
  const bagLine: SaleLineInput = {
    productId: 1,
    isLoose: false,
    bagSizeG: 50_000,
    quintalRate: 600_000,
    perKgRate: null,
    qty: 1
  }
  const looseLine: SaleLineInput = {
    productId: 1,
    isLoose: true,
    bagSizeG: null,
    quintalRate: null,
    perKgRate: 6_000,
    qty: 12.5
  }

  it('rejects an empty cart', () => {
    expect(validateSale([], products, cashCtx())).toMatch(/at least one line/)
  })

  it('rejects a bag line without a quintal rate', () => {
    const bad: SaleLineInput = { ...bagLine, quintalRate: null }
    expect(validateSale([bad], products, cashCtx())).toMatch(/Quintal Rate/)
  })

  it('rejects loose qty outside 1–50 kg', () => {
    expect(validateSale([{ ...looseLine, qty: 0.5 }], products, cashCtx())).toMatch(/1 and 50/)
    expect(validateSale([{ ...looseLine, qty: 51 }], products, cashCtx())).toMatch(/1 and 50/)
  })

  it('rejects loose without positive per-kg rate', () => {
    expect(validateSale([{ ...looseLine, perKgRate: null }], products, cashCtx())).toMatch(
      /price per kg/
    )
  })

  it('accepts a valid loose line', () => {
    expect(validateSale([looseLine], products, cashCtx())).toBeNull()
  })

  it('rejects a credit sale to a walk-in', () => {
    expect(
      validateSale(
        [bagLine],
        products,
        cashCtx({ mode: 'credit', hasCustomer: false, customerHasPhone: false, isWalkin: true })
      )
    ).toMatch(/Customer Master/)
  })

  it('rejects a credit sale to a customer with no phone', () => {
    expect(
      validateSale(
        [bagLine],
        products,
        cashCtx({ mode: 'credit', hasCustomer: true, customerHasPhone: false, isWalkin: false })
      )
    ).toMatch(/phone/)
  })

  it('accepts a valid cash sale', () => {
    expect(validateSale([bagLine], products, cashCtx())).toBeNull()
  })

  it('accepts exactly the default max line items', () => {
    const lines = Array.from({ length: DEFAULT_SETTINGS.maxLineItems }, () => ({ ...bagLine }))
    expect(validateSale(lines, products, cashCtx())).toBeNull()
  })

  it('rejects one line over the default cap', () => {
    const lines = Array.from({ length: DEFAULT_SETTINGS.maxLineItems + 1 }, () => ({ ...bagLine }))
    const reason = validateSale(lines, products, cashCtx())
    expect(reason).toBe(maxLineItemsExceededMessage(DEFAULT_SETTINGS.maxLineItems))
  })

  it('rejects over a custom maxLineItems setting', () => {
    const lines = Array.from({ length: 3 }, () => ({ ...bagLine }))
    const reason = validateSale(lines, products, cashCtx({ maxLineItems: 2 }))
    expect(reason).toBe(maxLineItemsExceededMessage(2))
    expect(validateSale(lines.slice(0, 2), products, cashCtx({ maxLineItems: 2 }))).toBeNull()
  })
})

describe('validatePurchase — max line items', () => {
  const products = new Map<number, LineProductLookup>([[1, { defaultBagSizeG: 50_000 }]])
  const bagLine: SaleLineInput = {
    productId: 1,
    isLoose: false,
    bagSizeG: 50_000,
    quintalRate: 600_000,
    perKgRate: null,
    qty: 1
  }

  it('rejects over a custom cap with the shared message', () => {
    const lines = Array.from({ length: 4 }, () => ({ ...bagLine }))
    expect(validatePurchase(lines, products, 3)).toBe(maxLineItemsExceededMessage(3))
  })

  it('accepts at the cap', () => {
    const lines = Array.from({ length: 3 }, () => ({ ...bagLine }))
    expect(validatePurchase(lines, products, 3)).toBeNull()
  })
})

describe('maxLineItemsExceededMessage', () => {
  it('names the cap and points to Settings', () => {
    const msg = maxLineItemsExceededMessage(10)
    expect(msg).toMatch(/10/)
    expect(msg).toMatch(/Line item limit/i)
    expect(msg).toMatch(/Settings/i)
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

describe('SaleWriteSchema (goods write boundary — integer paise)', () => {
  const validLine: SaleLineInput = {
    productId: 1,
    isLoose: true,
    bagSizeG: null,
    quintalRate: null,
    perKgRate: 6_000,
    qty: 8
  }

  const validSale = {
    mode: 'cash' as const,
    customerId: null,
    walkin: { name: 'A', place: 'B', phone: null },
    lines: [validLine],
    additionalCharges: 0,
    loadingCharges: 0,
    loadingApplied: true,
    cashCollected: 48_000,
    upiCollected: 0,
    voucherSeq: null,
    remarks: null
  }

  it('accepts a valid free-band opt-in sale (loading ₹0, applied true)', () => {
    expect(SaleWriteSchema.safeParse(validSale).success).toBe(true)
  })

  it('rejects float paise loading charge', () => {
    const result = SaleWriteSchema.safeParse({
      ...validSale,
      loadingCharges: 12.5
    })
    expect(result.success).toBe(false)
  })

  it('rejects float paise per-kg rate on a line', () => {
    const result = SaleWriteSchema.safeParse({
      ...validSale,
      lines: [{ ...validLine, perKgRate: 60.5 }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative additional charges', () => {
    expect(SaleWriteSchema.safeParse({ ...validSale, additionalCharges: -1 }).success).toBe(false)
  })
})

describe('validateSale — integer rates at write', () => {
  const products = new Map<number, LineProductLookup>([[1, { defaultBagSizeG: 50_000 }]])

  it('rejects non-integer per-kg rate', () => {
    expect(
      validateSale(
        [
          {
            productId: 1,
            isLoose: true,
            bagSizeG: null,
            quintalRate: null,
            perKgRate: 6000.5,
            qty: 5
          }
        ],
        products,
        cashCtx()
      )
    ).toMatch(/price per kg/)
  })

  it('rejects out-of-range loose qty at the same path the write boundary uses', () => {
    expect(
      validateSale(
        [
          {
            productId: 1,
            isLoose: true,
            bagSizeG: null,
            quintalRate: null,
            perKgRate: 6_000,
            qty: 0.5
          }
        ],
        products,
        cashCtx()
      )
    ).toMatch(/1 and 50/)
  })
})
