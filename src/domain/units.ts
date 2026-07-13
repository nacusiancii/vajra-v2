/**
 * Integer units for ledger-safe money and mass.
 *
 * - Money is stored and computed in **paise** (1 ₹ = 100 paise).
 * - Mass / Bag Types are stored in **grams** (1 kg = 1000 g).
 * - Stock deltas and Opening Stock are **grams**.
 *
 * UI may still collect rupees / kg; convert at the boundary with the helpers below.
 */

export const PAISE_PER_RUPEE = 100
export const G_PER_KG = 1000
/** One quintal = 100 kg = 100_000 g. */
export const QUINTAL_G = 100_000

/** Shipped Bag Types in grams (25 / 30 / 50 kg). */
export type BagSizeG = 25_000 | 30_000 | 50_000
export const BAG_SIZES_G: readonly BagSizeG[] = [25_000, 30_000, 50_000] as const

/** Round half away from zero to nearest integer (paise / grams). */
export function roundHalfAway(n: number): number {
  if (!Number.isFinite(n)) return 0
  return n >= 0 ? Math.round(n) : -Math.round(-n)
}

/** Rupees (may be fractional) → integer paise. */
export function rupeesToPaise(rupees: number): number {
  return roundHalfAway(rupees * PAISE_PER_RUPEE)
}

/** Integer paise → rupees (number for display / form fill). */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE
}

/**
 * Quantize a quantity to one decimal place (half-away via roundHalfAway).
 * Bags and loose kg both commit at 1dp — matches counter step habits (0.5 bags, 0.1 kg).
 */
export function quantizeQty(n: number): number {
  if (!Number.isFinite(n)) return 0
  return roundHalfAway(n * 10) / 10
}

/** Kilograms → grams (integer). */
export function kgToG(kg: number): number {
  return roundHalfAway(kg * G_PER_KG)
}

/** Grams → kilograms (number for display / form fill). */
export function gToKg(g: number): number {
  return g / G_PER_KG
}

export function isValidBagSizeG(g: number): g is BagSizeG {
  return (BAG_SIZES_G as readonly number[]).includes(g)
}

/**
 * Mass moved by a bag line: bags × bag size (grams).
 * Uses roundHalfAway so half-bags (0.5) stay exact against integer bag sizes.
 */
export function lineMassG(qtyBags: number, bagSizeG: number): number {
  return roundHalfAway(qtyBags * bagSizeG)
}

/**
 * Bag line total in paise: (mass_g / quintal_g) × quintal rate (paise).
 */
export function bulkLineTotalPaise(massG: number, quintalRatePaise: number): number {
  if (!(massG > 0) || !(quintalRatePaise > 0)) return 0
  return roundHalfAway((massG * quintalRatePaise) / QUINTAL_G)
}

/**
 * Loose line total in paise: kg × price-per-kg (paise).
 */
export function looseLineTotalPaise(kg: number, perKgRatePaise: number): number {
  if (!(kg > 0) || !(perKgRatePaise > 0)) return 0
  return roundHalfAway(kg * perKgRatePaise)
}

/** Loading: rate (paise/parcel) × count, rounded per line then summed by caller. */
export function loadingLinePaise(count: number, ratePaisePerParcel: number): number {
  return roundHalfAway(count * ratePaisePerParcel)
}

/** Bulk/bag stock change in grams. */
export function bulkStockDeltaG(qtyBags: number, bagSizeG: number, direction: 1 | -1): number {
  return direction * lineMassG(qtyBags, bagSizeG)
}

/** Loose stock change in grams: entered kg × 1000. */
export function looseStockDeltaG(kg: number, direction: 1 | -1): number {
  return direction * kgToG(kg)
}

/** Default-bag units for display: grams / default bag grams. */
export function stockGToDefaultBags(stockG: number, defaultBagSizeG: number): number {
  if (!(defaultBagSizeG > 0)) return 0
  return stockG / defaultBagSizeG
}
