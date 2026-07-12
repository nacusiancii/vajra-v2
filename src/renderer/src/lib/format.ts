/**
 * Display helpers for money and quantities.
 * Money arguments are **integer paise**. Mass arguments are **grams** where noted.
 * UI-only; never used for storage.
 */

import { gToKg, paiseToRupees, stockGToDefaultBags } from '@domain/units'

const RUPEE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

/** Format integer paise as ₹. */
export function formatRupees(paise: number): string {
  return RUPEE.format(paiseToRupees(paise))
}

/** Quantities print without trailing zeros: 1.5, 2, 0.5. */
export function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/\.?0+$/, '')
}

/** Bag Type grams → "25 kg" label. */
export function formatBagKg(bagSizeG: number): string {
  return `${formatQty(gToKg(bagSizeG))} kg`
}

/** Inventory / stock: bulk grams → default-bag units; packaged units as-is. */
export function formatStockQty(
  qty: number,
  productType: 'bulk' | 'packaged',
  defaultBagSizeG: number | null
): string {
  if (productType === 'packaged' || !defaultBagSizeG) return formatQty(qty)
  return formatQty(stockGToDefaultBags(qty, defaultBagSizeG))
}

/** Grams → kg label for slips / cart. */
export function formatKgFromG(massG: number): string {
  return `${formatQty(gToKg(massG))} kg`
}
