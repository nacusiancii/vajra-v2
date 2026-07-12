/**
 * Integer units for ledger-safe money and mass.
 *
 * - Money is stored and computed in **paise** (1 ₹ = 100 paise).
 * - Mass / Bag Types are stored in **grams** (1 kg = 1000 g).
 * - Bulk stock deltas and Opening Stock for Bulk Products are **grams**.
 * - Packaged stock is whole **units** (not mass).
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

/** Schema identity written into every new DB. Old DBs without this are wiped. */
export const SCHEMA_IDENTITY = 'paise-grams-v1'

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
 * Mass moved by a bulk line: bags × bag size (grams).
 * Uses roundHalfAway so half-bags (0.5) stay exact against integer bag sizes.
 */
export function lineMassG(qtyBags: number, bagSizeG: number): number {
  return roundHalfAway(qtyBags * bagSizeG)
}

/**
 * Bulk line total in paise: (mass_g / quintal_g) × quintal rate (paise).
 * Packaged: qty × unit rate (paise), rounded.
 */
export function bulkLineTotalPaise(massG: number, quintalRatePaise: number): number {
  if (!(massG > 0) || !(quintalRatePaise > 0)) return 0
  return roundHalfAway((massG * quintalRatePaise) / QUINTAL_G)
}

export function packagedLineTotalPaise(qty: number, unitRatePaise: number): number {
  return roundHalfAway(qty * unitRatePaise)
}

/** Loading: rate (paise/bag) × bag count, rounded per line then summed by caller. */
export function loadingLinePaise(qtyBags: number, ratePaisePerBag: number): number {
  return roundHalfAway(qtyBags * ratePaisePerBag)
}

/**
 * Bulk stock change in grams. Packaged stock change is unit count (use qty directly).
 */
export function bulkStockDeltaG(qtyBags: number, bagSizeG: number, direction: 1 | -1): number {
  return direction * lineMassG(qtyBags, bagSizeG)
}

/** Default-bag units for display: grams / default bag grams. */
export function stockGToDefaultBags(stockG: number, defaultBagSizeG: number): number {
  if (!(defaultBagSizeG > 0)) return 0
  return stockG / defaultBagSizeG
}
