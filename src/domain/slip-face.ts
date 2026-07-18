/**
 * Customer-facing Sale Invoice / Credit Voucher face fields (ADR-0003).
 *
 * Operator UI stays English. These helpers apply only to customer-facing
 * artifacts (SlipPreview, CreditVoucherPreview, and print paths that feed them).
 *
 * - Customer Master name/place: Telugu when present; blank handwriting gap when
 *   missing — never English-fallback on the customer face.
 * - Walk-in: English strings stored on the Sale (no Telugu master).
 * - Product lines: Telugu preferred; fall back to English name only if nameTe empty.
 */

/** True when the finished Sale used walk-in (no Customer Master entry). */
export function isWalkinTxn(t: { customerId: number | null; walkinName: string | null }): boolean {
  return t.customerId == null
}

/**
 * Counterparty name on the customer face.
 * Walk-in → English walk-in label; master → nameTe or blank (no English fallback).
 */
export function slipFaceCustomerName(input: {
  isWalkin: boolean
  walkinName: string | null | undefined
  /** Customer Master Telugu name (ignored for walk-in). */
  nameTe: string | null | undefined
}): string {
  if (input.isWalkin) {
    const n = input.walkinName?.trim()
    return n || 'Walk in'
  }
  return input.nameTe?.trim() || ''
}

/**
 * Place on the customer face.
 * Walk-in → English walk-in place; master → placeTe or blank (no English fallback).
 */
export function slipFacePlace(input: {
  isWalkin: boolean
  walkinPlace: string | null | undefined
  /** Customer Master Telugu place (ignored for walk-in). */
  placeTe: string | null | undefined
}): string {
  if (input.isWalkin) {
    return input.walkinPlace?.trim() || ''
  }
  return input.placeTe?.trim() || ''
}

/**
 * Product line name on the customer face: Telugu first, English only if nameTe empty
 * so the invoice stays readable when a translation was never entered.
 */
export function slipFaceProductName(
  englishName: string,
  nameTe: string | null | undefined
): string {
  const te = nameTe?.trim()
  return te || englishName
}
