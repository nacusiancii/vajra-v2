/**
 * Form helpers: cashier types rupees; domain/API use integer paise.
 */

import { paiseToRupees, rupeesToPaise } from '@domain/units'

/** Parse a number-input value (rupees) into paise; empty → null. */
export function parseRupeesInput(value: string | number): number | null {
  if (value === '' || value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  return rupeesToPaise(n)
}

/** Bind paise state back to a number input showing rupees. */
export function paiseInputValue(paise: number | null | undefined): string | number {
  if (paise == null) return ''
  return paiseToRupees(paise)
}
