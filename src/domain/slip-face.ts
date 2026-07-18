/**
 * Customer-facing Sale Invoice / Credit Voucher face fields (ADR-0003).
 *
 * Operator UI stays English. These helpers apply only to customer-facing
 * artifacts (SlipPreview, CreditVoucherPreview, and print paths that feed them).
 *
 * Telugu when present, otherwise English — no blank/handwriting gap for missing
 * translations. Walk-in sales use English strings stored on the Sale.
 */

/** True when the finished Sale used walk-in (no Customer Master entry). */
export function isWalkinTxn(t: { customerId: number | null }): boolean {
  return t.customerId == null
}

/**
 * Counterparty name on the customer face.
 * Walk-in → English walk-in label; master → nameTe when set, else English name.
 */
export function slipFaceCustomerName(input: {
  isWalkin: boolean
  walkinName: string | null | undefined
  /** Customer Master Telugu name (ignored for walk-in). */
  nameTe: string | null | undefined
  /** Customer Master English name (fallback when nameTe empty). */
  nameEn: string | null | undefined
}): string {
  if (input.isWalkin) {
    const n = input.walkinName?.trim()
    return n || 'Walk in'
  }
  const te = input.nameTe?.trim()
  if (te) return te
  return input.nameEn?.trim() || ''
}

/**
 * Place on the customer face.
 * Walk-in → English walk-in place; master → placeTe when set, else English place.
 */
export function slipFacePlace(input: {
  isWalkin: boolean
  walkinPlace: string | null | undefined
  /** Customer Master Telugu place (ignored for walk-in). */
  placeTe: string | null | undefined
  /** Customer Master English place (fallback when placeTe empty). */
  placeEn: string | null | undefined
}): string {
  if (input.isWalkin) {
    return input.walkinPlace?.trim() || ''
  }
  const te = input.placeTe?.trim()
  if (te) return te
  return input.placeEn?.trim() || ''
}

/**
 * Product line name on the customer face: Telugu first, English when nameTe empty.
 */
export function slipFaceProductName(
  englishName: string,
  nameTe: string | null | undefined
): string {
  const te = nameTe?.trim()
  return te || englishName
}
