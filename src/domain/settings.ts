import { BAG_SIZES, type BagSizeKg } from './types'

/**
 * App-level configuration (CONTEXT.md, ADR-0008). Persisted as a single JSON row.
 */
export interface AppSettings {
  /** When on, finishing a Sale shows the would-be slip on screen instead of printing. */
  printerlessMode: boolean
  /** Shop / company name printed on the Credit Voucher front side. */
  companyName: string
  /** The Bag Types the shop uses for pricing-by-weight and Loading Charges. */
  bagTypes: BagSizeKg[]
  /** Opt-in Loading Charge as a rupee rate per bag, keyed by Bag Type. 0 = not charged. */
  loadingChargePerBag: Record<number, number>
}

export const DEFAULT_SETTINGS: AppSettings = {
  printerlessMode: false,
  companyName: '',
  bagTypes: [...BAG_SIZES],
  loadingChargePerBag: { 25: 0, 30: 0, 50: 0 }
}
