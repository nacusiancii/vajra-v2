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
 * Weight breakpoints for Loading Charge, plus the charge above the last breakpoint.
 * Lookup is order-independent: among breakpoints where weightKg ≤ upToKg, the one with
 * the smallest upToKg wins; else aboveLastPaise. Settings persist them sorted ascending.
 */
export interface LoadingChargeRules {
  /** Inclusive upper bounds; order in the array does not affect lookup. */
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
  /**
   * Max goods line items on a Sale or Purchase cart (thermal slip fit).
   * Default 10; enforced in UI, domain validation, and write boundary.
   */
  maxLineItems: number
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
  draftCap: 5,
  maxLineItems: 10
}

/**
 * Resolve Loading Charge (paise) for a single parcel of the given weight in kg.
 * Order-independent: among qualifying breakpoints (weightKg ≤ upToKg), pick the
 * smallest upToKg. Empty / no match → aboveLastPaise.
 */
export function loadingChargeForKg(weightKg: number, rules: LoadingChargeRules): number {
  if (!(weightKg > 0)) return 0
  let best: LoadingBreakpoint | null = null
  for (const bp of rules.breakpoints) {
    if (weightKg <= bp.upToKg && (best === null || bp.upToKg < best.upToKg)) {
      best = bp
    }
  }
  return best !== null ? best.chargePaise : rules.aboveLastPaise
}
