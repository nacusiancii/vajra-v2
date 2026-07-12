import { BAG_SIZES_G, type BagSizeG } from './units'

/**
 * One weight breakpoint for Loading Charge: weight up to and including `upToKg`
 * is charged `chargePaise` per bag / per Loose parcel.
 */
export interface LoadingBreakpoint {
  /** Inclusive upper bound in kg. */
  upToKg: number
  /** Charge in paise for a parcel whose weight is ≤ upToKg. */
  chargePaise: number
}

/**
 * Ordered weight breakpoints for Loading Charge, plus the charge above the last breakpoint.
 * Lookup: first breakpoint where weightKg ≤ upToKg wins; else aboveLastPaise.
 */
export interface LoadingChargeRules {
  /** Must be ordered ascending by upToKg. */
  breakpoints: LoadingBreakpoint[]
  /** Charge (paise) for weight strictly above the last breakpoint. */
  aboveLastPaise: number
}

/**
 * App-level configuration (CONTEXT.md, ADR-0008). Persisted as a single JSON row.
 * Money rates are **paise**; Bag Types are **grams**.
 */
export interface AppSettings {
  /** When on, finishing a Sale shows the would-be slip on screen instead of printing. */
  printerlessMode: boolean
  /** Shop / company name printed on the Credit Voucher front side. */
  companyName: string
  /** The Bag Types the shop uses for pricing-by-weight (grams). */
  bagTypes: BagSizeG[]
  /**
   * Loading Charge by weight breakpoints (paise per bag / per Loose parcel).
   * Opt-in at the Sale cart level only.
   */
  loadingCharge: LoadingChargeRules
  /**
   * Global max Drafts for the open Business Day (Sale + Purchase share one pool).
   * ADR-0010 — default 5; no per-type caps.
   */
  draftCap: number
}

/** Default: ≤10 kg → ₹0, ≤30 kg → ₹10, above → ₹12. */
export const DEFAULT_LOADING_CHARGE: LoadingChargeRules = {
  breakpoints: [
    { upToKg: 10, chargePaise: 0 },
    { upToKg: 30, chargePaise: 1_000 }
  ],
  aboveLastPaise: 1_200
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Locked on until thermal print lands (#22 / #28).
  printerlessMode: true,
  companyName: '',
  bagTypes: [...BAG_SIZES_G],
  loadingCharge: {
    ...DEFAULT_LOADING_CHARGE,
    breakpoints: [...DEFAULT_LOADING_CHARGE.breakpoints]
  },
  draftCap: 5
}

/**
 * Resolve Loading Charge (paise) for a single parcel of the given weight in kg.
 * Empty breakpoints → always aboveLastPaise (or 0 if that is also 0).
 */
export function loadingChargeForKg(weightKg: number, rules: LoadingChargeRules): number {
  if (!(weightKg > 0)) return 0
  for (const bp of rules.breakpoints) {
    if (weightKg <= bp.upToKg) return bp.chargePaise
  }
  return rules.aboveLastPaise
}
