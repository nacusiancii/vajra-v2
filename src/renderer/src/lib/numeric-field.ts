/**
 * Parse / format helpers for NumericField.
 * Domain values stay numeric (paise, qty, kg, integers); only the focused input
 * holds a free-form string buffer (editText) while typing.
 */

import { paiseToRupees, quantizeQty, rupeesToPaise } from '@domain/units'

export type NumericFieldMode = 'money' | 'qty' | 'decimal' | 'integer'

/** Result of committing a typed string on blur / Enter. */
export type CommitParse = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'value'; value: number }

/**
 * Parse a mid-typing or finished numeric string into a plain number.
 * Empty → empty. Unparseable ("-", ".", "abc") → invalid.
 * Trailing dot on a number ("3.") resolves to the integer part on commit.
 */
export function parseNumericText(text: string): CommitParse {
  const t = text.trim()
  if (t === '') return { kind: 'empty' }

  // "3." mid-type is valid to show; on commit treat as 3.
  let normalized = t
  if (normalized.length > 1 && normalized.endsWith('.') && normalized !== '-.') {
    normalized = normalized.slice(0, -1)
  }

  if (normalized === '' || normalized === '-' || normalized === '.') {
    return { kind: 'invalid' }
  }

  // Complete number: optional sign, digits, optional fractional part; or leading-dot fraction.
  if (!/^-?\d+(\.\d+)?$/.test(normalized) && !/^-?\.\d+$/.test(normalized)) {
    return { kind: 'invalid' }
  }

  const n = Number(normalized)
  if (!Number.isFinite(n)) return { kind: 'invalid' }
  return { kind: 'value', value: n }
}

/** Format domain money (paise) as a plain rupee string for the input (no ₹, no grouping). */
export function formatMoneyDomain(paise: number | null | undefined): string {
  if (paise == null) return ''
  const r = paiseToRupees(paise)
  return r.toFixed(2).replace(/\.?0+$/, '')
}

/** Format qty / decimal domain values for the unfocused input. */
export function formatQtyDomain(qty: number | null | undefined): string {
  if (qty == null) return ''
  if (!Number.isFinite(qty)) return ''
  return qty.toFixed(2).replace(/\.?0+$/, '')
}

export function formatIntegerDomain(n: number | null | undefined): string {
  if (n == null) return ''
  if (!Number.isFinite(n)) return ''
  return String(Math.trunc(n))
}

export function formatDomainValue(
  mode: NumericFieldMode,
  value: number | null | undefined
): string {
  switch (mode) {
    case 'money':
      return formatMoneyDomain(value)
    case 'qty':
    case 'decimal':
      return formatQtyDomain(value)
    case 'integer':
      return formatIntegerDomain(value)
  }
}

/**
 * Parse typed text into the domain value for the given mode.
 * money → integer paise; qty → 1dp; decimal → finite number; integer → trunc.
 */
export function parseDomainValue(mode: NumericFieldMode, text: string): CommitParse {
  const raw = parseNumericText(text)
  if (raw.kind !== 'value') return raw

  switch (mode) {
    case 'money':
      return { kind: 'value', value: rupeesToPaise(raw.value) }
    case 'qty':
      return { kind: 'value', value: quantizeQty(raw.value) }
    case 'decimal':
      return { kind: 'value', value: raw.value }
    case 'integer':
      return { kind: 'value', value: Math.trunc(raw.value) }
  }
}
