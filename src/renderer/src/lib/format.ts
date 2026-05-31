/** Display helpers for money and quantities. UI-only; never used for storage. */

const RUPEE = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatRupees(amount: number): string {
  return RUPEE.format(amount)
}

/** Quantities print without trailing zeros: 1.5, 2, 0.5. */
export function formatQty(qty: number): string {
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2).replace(/\.?0+$/, '')
}
