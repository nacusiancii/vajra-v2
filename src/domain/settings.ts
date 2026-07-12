import { BAG_SIZES_G, type BagSizeG } from './units'

/**
 * App-level configuration (CONTEXT.md, ADR-0008). Persisted as a single JSON row.
 * Money rates are **paise**; Bag Types are **grams**.
 */
export interface AppSettings {
  /** When on, finishing a Sale shows the would-be slip on screen instead of printing. */
  printerlessMode: boolean
  /** Shop / company name printed on the Credit Voucher front side. */
  companyName: string
  /** The Bag Types the shop uses for pricing-by-weight and Loading Charges (grams). */
  bagTypes: BagSizeG[]
  /** Opt-in Loading Charge as paise per bag, keyed by Bag Type (grams). 0 = not charged. */
  loadingChargePerBag: Record<number, number>
  /**
   * Global max Drafts for the open Business Day (Sale + Purchase share one pool).
   * ADR-0010 — default 5; no per-type caps.
   */
  draftCap: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Locked on until thermal print lands (#22 / #28).
  printerlessMode: true,
  companyName: '',
  bagTypes: [...BAG_SIZES_G],
  loadingChargePerBag: { 25_000: 0, 30_000: 0, 50_000: 0 },
  draftCap: 5
}
