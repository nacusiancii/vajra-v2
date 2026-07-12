/**
 * Pure pricing and validation rules for the transactional core.
 * Shared by the cart UIs (live totals) and the repository (authoritative write).
 *
 * Money arguments and return values are **integer paise**.
 * Bag sizes are **integer grams**. Loose qty is **kg**.
 */

import { z } from 'zod'
import { loadingChargeForKg, type LoadingChargeRules } from './settings'
import type { SaleLineInput, TransferLegInput } from './transaction'
import {
  bulkLineTotalPaise,
  gToKg,
  kgToG,
  loadingLinePaise,
  lineMassG,
  looseLineTotalPaise
} from './units'

/** Mass in grams a goods line moves (bag line or Loose). */
export function lineMassGrams(args: {
  isLoose: boolean
  qty: number
  bagSizeG: number | null
}): number {
  if (args.isLoose) return kgToG(args.qty)
  if (!args.bagSizeG) return 0
  return lineMassG(args.qty, args.bagSizeG)
}

/** Kilograms for a goods line (display / transfer yield UI). */
export function lineKg(args: { isLoose: boolean; qty: number; bagSizeG: number | null }): number {
  return lineMassGrams(args) / 1000
}

/**
 * Suggested target bag count so source mass lands on the target Product's Default Bag Size.
 * sourceMassG and targetDefaultBagSizeG are grams. Returns bag count (may be fractional).
 */
export function suggestedTransferTargetQty(
  sourceMassG: number,
  targetDefaultBagSizeG: number | null
): number | null {
  if (!(sourceMassG > 0) || targetDefaultBagSizeG == null || !(targetDefaultBagSizeG > 0)) {
    return null
  }
  return sourceMassG / targetDefaultBagSizeG
}

/**
 * Money total for one line, in paise.
 * Bag: (mass_g / quintal_g) × Quintal Rate. Loose: kg × per-kg rate.
 */
export function lineTotal(args: {
  isLoose: boolean
  qty: number
  bagSizeG: number | null
  quintalRate: number | null
  perKgRate: number | null
}): number {
  if (args.isLoose) {
    return looseLineTotalPaise(args.qty, args.perKgRate ?? 0)
  }
  const massG = lineMassGrams({ isLoose: false, qty: args.qty, bagSizeG: args.bagSizeG })
  return bulkLineTotalPaise(massG, args.quintalRate ?? 0)
}

/** Grand total in paise = sum of line totals + opt-in Loading Charge + Additional Charges. */
export function grandTotal(lineTotals: number[], loading: number, additional: number): number {
  return lineTotals.reduce((a, b) => a + b, 0) + loading + additional
}

export interface LoadingLineInput {
  isLoose: boolean
  bagSizeG: number | null
  /** Bag count for bag lines; kg for Loose. */
  qty: number
}

/**
 * Loading Charge for a cart from weight-breakpoint rules.
 * - Bag line: each bag is charged by its bag weight (kg); multiply by bag count.
 * - Loose line: the whole quantity is one parcel charged by its total kg.
 * Returns 0 when rules yield zero for every parcel.
 */
export function computeLoadingCharge(lines: LoadingLineInput[], rules: LoadingChargeRules): number {
  let total = 0
  for (const l of lines) {
    if (!(l.qty > 0)) continue
    if (l.isLoose) {
      total += loadingChargeForKg(l.qty, rules)
    } else if (l.bagSizeG) {
      const bagKg = gToKg(l.bagSizeG)
      const rate = loadingChargeForKg(bagKg, rules)
      total += loadingLinePaise(l.qty, rate)
    }
  }
  return total
}

// ── Validation (returns a human-readable reason, or null when valid) ─────────

export interface LineProductLookup {
  defaultBagSizeG: number
}

function validateGoodsLine(
  line: SaleLineInput,
  product: LineProductLookup | undefined
): string | null {
  if (!product) return 'Line references an unknown Product'
  if (!(line.qty > 0)) return 'Quantity must be greater than zero'
  if (line.isLoose) {
    if (!(line.qty >= 1 && line.qty <= 50)) return 'Loose quantity must be between 1 and 50 kg'
    if (!(typeof line.perKgRate === 'number' && line.perKgRate > 0))
      return 'Loose lines need a price per kg'
  } else {
    if (!line.bagSizeG) return 'Bag lines need a Bag Type'
    if (!(typeof line.quintalRate === 'number' && line.quintalRate > 0))
      return 'Bag lines need a Quintal Rate'
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
  if (!leg.bagSizeG) return 'Transfer legs need a Bag Type'
  return null
}

// ── Money movement schema (Receipt / Payment / Expense / Income) ─────────────

/**
 * Authoritative shape for money movements. Amounts are integer **paise**.
 * Pure write-off (cash=0, UPI=0, discount>0) is allowed; all-zero is not.
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
    cashCollected: z.coerce.number().int().min(0, 'Cash cannot be negative').default(0),
    upiCollected: z.coerce.number().int().min(0, 'UPI cannot be negative').default(0),
    discountAmount: z.coerce.number().int().min(0, 'Discount cannot be negative').default(0),
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
