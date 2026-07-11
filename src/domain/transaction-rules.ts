/**
 * Pure pricing and validation rules for the transactional core.
 * Shared by the cart UIs (live totals) and the repository (authoritative write).
 */

import { z } from 'zod'
import type { ProductType } from './types'
import type { SaleLineInput, TransferLegInput } from './transaction'

const QUINTAL_KG = 100

/** Kilograms a single Bulk line moves: qty bags × bag size. Packaged returns 0 (counted in units). */
export function lineKg(productType: ProductType, qty: number, bagSizeKg: number | null): number {
  if (productType !== 'bulk' || !bagSizeKg) return 0
  return qty * bagSizeKg
}

/**
 * Suggested target bag count so source kg lands on the target Product's Default Bag Size.
 * Used by Stock Transfer UI auto-fill; cashier may still override for yield differences.
 * Returns null when not computable (no kg, missing/invalid default bag).
 */
export function suggestedTransferTargetQty(
  sourceKg: number,
  targetDefaultBagSizeKg: number | null
): number | null {
  if (!(sourceKg > 0) || targetDefaultBagSizeKg == null || !(targetDefaultBagSizeKg > 0)) {
    return null
  }
  return sourceKg / targetDefaultBagSizeKg
}

/**
 * Money total for one line.
 * Bulk: (kg / 100) × Quintal Rate. Packaged: qty × unit rate.
 */
export function lineTotal(args: {
  productType: ProductType
  qty: number
  bagSizeKg: number | null
  quintalRate: number | null
  unitRate: number | null
}): number {
  const { productType, qty, bagSizeKg, quintalRate, unitRate } = args
  if (productType === 'bulk') {
    const kg = lineKg('bulk', qty, bagSizeKg)
    return (kg / QUINTAL_KG) * (quintalRate ?? 0)
  }
  return qty * (unitRate ?? 0)
}

/** Grand total = sum of line totals + opt-in Loading Charge + Additional Charges. */
export function grandTotal(lineTotals: number[], loading: number, additional: number): number {
  return lineTotals.reduce((a, b) => a + b, 0) + loading + additional
}

/**
 * Loading Charge for a cart from per-Bag-Type rules. Charged per bag of each Bulk line.
 * Returns 0 when not opted in (empty rules).
 */
export function computeLoadingCharge(
  lines: Array<{ productType: ProductType; bagSizeKg: number | null; qty: number }>,
  ratePerBagBySize: Record<number, number>
): number {
  let total = 0
  for (const l of lines) {
    if (l.productType !== 'bulk' || !l.bagSizeKg) continue
    const rate = ratePerBagBySize[l.bagSizeKg] ?? 0
    total += rate * l.qty
  }
  return total
}

// ── Validation (returns a human-readable reason, or null when valid) ─────────

export interface LineProductLookup {
  type: ProductType
  defaultBagSizeKg: number | null
}

function validateGoodsLine(
  line: SaleLineInput,
  product: LineProductLookup | undefined
): string | null {
  if (!product) return 'Line references an unknown Product'
  if (!(line.qty > 0)) return 'Quantity must be greater than zero'
  if (product.type === 'bulk') {
    if (!line.bagSizeKg) return 'Bulk lines need a Bag Type'
    if (!(typeof line.quintalRate === 'number' && line.quintalRate > 0))
      return 'Bulk lines need a Quintal Rate'
  } else {
    if (!(typeof line.unitRate === 'number' && line.unitRate > 0))
      return 'Packaged lines need a unit rate'
  }
  return null
}

export interface SaleValidationContext {
  mode: 'cash' | 'credit'
  hasCustomer: boolean
  /** Whether the chosen Customer Master entry has a phone (Credit Sale requirement). */
  customerHasPhone: boolean
  isWalkin: boolean
}

/** Business rules for finishing a Sale. UI-level (qty/rate) reasons come first. */
export function validateSale(
  lines: SaleLineInput[],
  products: Map<number, LineProductLookup>,
  ctx: SaleValidationContext
): string | null {
  if (lines.length === 0) return 'Add at least one line before finishing'
  for (const line of lines) {
    const reason = validateGoodsLine(line, products.get(line.productId))
    if (reason) return reason
  }
  if (ctx.mode === 'credit') {
    if (ctx.isWalkin || !ctx.hasCustomer) return 'Credit Sales require a Customer Master entry'
    if (!ctx.customerHasPhone) return 'Credit Sales require a phone number on the Customer'
  }
  return null
}

export function validatePurchase(
  lines: SaleLineInput[],
  products: Map<number, LineProductLookup>
): string | null {
  if (lines.length === 0) return 'Add at least one line before finishing'
  for (const line of lines) {
    const reason = validateGoodsLine(line, products.get(line.productId))
    if (reason) return reason
  }
  return null
}

export function validateTransferLeg(
  leg: TransferLegInput,
  product: LineProductLookup | undefined
): string | null {
  if (!product) return 'Leg references an unknown Product'
  if (!(leg.qty > 0)) return 'Quantity must be greater than zero'
  if (product.type === 'bulk' && !leg.bagSizeKg) return 'Bulk legs need a Bag Type'
  return null
}

// ── Money movement schema (Receipt / Payment / Expense / Income) ─────────────

/**
 * Authoritative shape for money movements. Cashier enters cash, UPI, and (for RE/PA)
 * discount amount; pure write-off (cash=0, UPI=0, discount>0) is allowed; all-zero is not.
 * `total` is always derived as cash + UPI — never taken from the client.
 */
export const MoneyTxnSchema = z
  .object({
    customerId: z.number().nullable(),
    label: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable(),
    cashCollected: z.coerce.number().min(0, 'Cash cannot be negative').default(0),
    upiCollected: z.coerce.number().min(0, 'UPI cannot be negative').default(0),
    discountAmount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
    remarks: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable()
  })
  .refine((v) => v.cashCollected + v.upiCollected + v.discountAmount > 0, {
    message: 'Enter cash, UPI, or a discount amount',
    path: ['cashCollected']
  })
