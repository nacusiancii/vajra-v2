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

/**
 * Quantities: at most two decimal places, no trailing zeros.
 * 2 → "2", 1.5 → "1.5", 0.30000000004 → "0.3"
 */
export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0'
  return qty.toFixed(2).replace(/\.?0+$/, '')
}

/** Bag Type grams → "25 kg" label. */
export function formatBagKg(bagSizeG: number): string {
  return `${formatQty(gToKg(bagSizeG))} kg`
}

/**
 * Inventory / stock display: grams → default-bag units.
 */
export function formatStockQty(qtyG: number, defaultBagSizeG: number): string {
  if (!defaultBagSizeG) return formatQty(qtyG)
  return formatQty(stockGToDefaultBags(qtyG, defaultBagSizeG))
}

/** Grams → kg label for slips / cart. */
export function formatKgFromG(massG: number): string {
  return `${formatQty(gToKg(massG))} kg`
}

/** Business Day YYYY-MM-DD → DD/MM/YYYY for printed slips; passes anything else through. */
export function formatSlipDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!m) return isoDate || '—'
  return `${m[3]}/${m[2]}/${m[1]}`
}
