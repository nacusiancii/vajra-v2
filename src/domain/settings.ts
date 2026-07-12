/**
 * App-level configuration (CONTEXT.md, ADR-0008). Persisted as a single JSON row.
 * Money rates are **paise**; mass breakpoints are **grams**.
 */

/** One Loading Charge tier: charge applies when total bulk mass is ≤ maxMassG (or any mass if null). */
export interface LoadingChargeBreakpoint {
  /** Inclusive upper bound in grams. null = catch-all for mass above all prior tiers. */
  maxMassG: number | null
  /** Flat charge in paise for the cart when total bulk mass falls in this tier. */
  chargePaise: number
}

/**
 * App-level configuration (CONTEXT.md, ADR-0008). Persisted as a single JSON row.
 * Money rates are **paise**; mass breakpoints are **grams**.
 */
export interface AppSettings {
  /** When on, finishing a Sale shows the would-be slip on screen instead of printing. */
  printerlessMode: boolean
  /** Shop / company name printed on the Credit Voucher front side. */
  companyName: string
  /**
   * Loading Charge tiers ordered by increasing maxMassG (null last).
   * Opt-in at Sale settle: one flat charge for the cart's total bulk mass.
   */
  loadingChargeBreakpoints: LoadingChargeBreakpoint[]
  /**
   * Global max Drafts for the open Business Day (Sale + Purchase share one pool).
   * ADR-0010 — default 5; no per-type caps.
   */
  draftCap: number
}

/** Shipped defaults: ≤10 kg → ₹0, ≤30 kg → ₹10, above → ₹12. */
export const DEFAULT_LOADING_BREAKPOINTS: LoadingChargeBreakpoint[] = [
  { maxMassG: 10_000, chargePaise: 0 },
  { maxMassG: 30_000, chargePaise: 1_000 },
  { maxMassG: null, chargePaise: 1_200 }
]

export const DEFAULT_SETTINGS: AppSettings = {
  // Locked on until thermal print lands (#22 / #28).
  printerlessMode: true,
  companyName: '',
  loadingChargeBreakpoints: DEFAULT_LOADING_BREAKPOINTS.map((b) => ({ ...b })),
  draftCap: 5
}
