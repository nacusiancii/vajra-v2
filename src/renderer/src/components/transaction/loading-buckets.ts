import { loadingChargeForKg, type LoadingChargeRules } from '@domain/settings'
import { gToKg } from '@domain/units'

/** One weight class's contribution to the cart's Loading Charge (for display). */
export interface LoadingWeightBucket {
  /** Parcel weight in kg (bag size for bag lines; total kg for Loose). */
  weightKg: number
  /** Bag count, or 1 for each Loose parcel. */
  count: number
  /** Charge paise per parcel of this weight. */
  chargePerParcel: number
  isLoose: boolean
}

/**
 * Group cart lines for the Settle receipt Loading Charge breakdown.
 * Bag lines group by bag weight; each Loose line is its own parcel by total kg.
 */
export function loadingChargeBuckets(
  lines: Array<{ isLoose: boolean; bagSizeG: number | null; qty: number }>,
  rules: LoadingChargeRules
): LoadingWeightBucket[] {
  const bagMap = new Map<number, LoadingWeightBucket>()
  const loose: LoadingWeightBucket[] = []

  for (const l of lines) {
    if (!(l.qty > 0)) continue
    if (l.isLoose) {
      const weightKg = l.qty
      loose.push({
        weightKg,
        count: 1,
        chargePerParcel: loadingChargeForKg(weightKg, rules),
        isLoose: true
      })
    } else if (l.bagSizeG) {
      const weightKg = gToKg(l.bagSizeG)
      const existing = bagMap.get(weightKg)
      if (existing) {
        existing.count += l.qty
      } else {
        bagMap.set(weightKg, {
          weightKg,
          count: l.qty,
          chargePerParcel: loadingChargeForKg(weightKg, rules),
          isLoose: false
        })
      }
    }
  }

  return [...bagMap.values()].sort((a, b) => a.weightKg - b.weightKg).concat(loose)
}
