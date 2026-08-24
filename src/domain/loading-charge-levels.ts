/**
 * Loading Charge grouping by settings price-level breakpoints.
 *
 * Breakpoint identity (smallest qualifying `upToKg`, else `above`) — not bag
 * weight. Bags and Loose that share a key merge. Zero-charge levels omitted.
 * Unused breakpoints are not synthesised.
 */
import { loadingChargeForKg, type LoadingChargeRules } from './settings'
import { computeLoadingCharge, type LoadingLineInput } from './transaction-rules'
import { gToKg, loadingLinePaise, paiseToRupees } from './units'

export type LoadingPriceLevelKey = { kind: 'upTo'; upToKg: number } | { kind: 'above' }

export interface LoadingPriceLevel {
  key: LoadingPriceLevelKey
  /** Bag qty summed, plus 1 per Loose line. May be fractional (half-bags). */
  count: number
  /** Paise per parcel from current rules (the breakpoint’s charge). */
  chargePerParcel: number
  /** `loadingLinePaise(count, chargePerParcel)` after grouping. */
  amountPaise: number
}

export type SaleLoadingBreakdown =
  | { kind: 'none' }
  | { kind: 'levels'; levels: LoadingPriceLevel[] }
  | { kind: 'lump' }

function keyId(key: LoadingPriceLevelKey): string {
  return key.kind === 'upTo' ? `upTo:${key.upToKg}` : 'above'
}

/** Same lookup as `loadingChargeForKg`: smallest qualifying `upToKg`, else `above`. */
function priceLevelKeyForKg(weightKg: number, rules: LoadingChargeRules): LoadingPriceLevelKey {
  let bestUpTo: number | null = null
  for (const bp of rules.breakpoints) {
    if (weightKg <= bp.upToKg && (bestUpTo === null || bp.upToKg < bestUpTo)) {
      bestUpTo = bp.upToKg
    }
  }
  return bestUpTo !== null ? { kind: 'upTo', upToKg: bestUpTo } : { kind: 'above' }
}

export function loadingChargePriceLevels(
  lines: LoadingLineInput[],
  rules: LoadingChargeRules
): LoadingPriceLevel[] {
  const grouped = new Map<
    string,
    { key: LoadingPriceLevelKey; count: number; chargePerParcel: number }
  >()

  for (const l of lines) {
    if (!(l.qty > 0)) continue
    let weightKg: number
    let addCount: number
    if (l.isLoose) {
      weightKg = l.qty
      addCount = 1
    } else if (l.bagSizeG) {
      weightKg = gToKg(l.bagSizeG)
      addCount = l.qty
    } else {
      continue
    }

    const key = priceLevelKeyForKg(weightKg, rules)
    const existing = grouped.get(keyId(key))
    if (existing) {
      existing.count += addCount
    } else {
      grouped.set(keyId(key), {
        key,
        count: addCount,
        chargePerParcel: loadingChargeForKg(weightKg, rules)
      })
    }
  }

  const levels: LoadingPriceLevel[] = []
  for (const g of grouped.values()) {
    if (g.chargePerParcel === 0) continue
    levels.push({
      key: g.key,
      count: g.count,
      chargePerParcel: g.chargePerParcel,
      amountPaise: loadingLinePaise(g.count, g.chargePerParcel)
    })
  }

  levels.sort((a, b) => {
    if (a.key.kind === 'above') return 1
    if (b.key.kind === 'above') return -1
    return a.key.upToKg - b.key.upToKg
  })
  return levels
}

export function saleLoadingBreakdown(
  lines: LoadingLineInput[],
  loadingCharges: number,
  rules: LoadingChargeRules
): SaleLoadingBreakdown {
  if (loadingCharges === 0) return { kind: 'none' }
  if (computeLoadingCharge(lines, rules) === loadingCharges) {
    return { kind: 'levels', levels: loadingChargePriceLevels(lines, rules) }
  }
  return { kind: 'lump' }
}

export function loadingPriceLevelProductLabel(level: LoadingPriceLevel): string {
  const rupees = paiseToRupees(level.chargePerParcel)
  const rate = Number.isInteger(rupees) ? String(rupees) : rupees.toFixed(2)
  const count = String(level.count)
  if (level.key.kind === 'upTo') {
    return `${count} × ₹${rate} (≤${level.key.upToKg} kg)`
  }
  return `${count} × ₹${rate} (above)`
}
