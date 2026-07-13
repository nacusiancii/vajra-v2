import { describe, expect, it } from 'vitest'
import { lineMassGrams, lineTotal } from '@domain/transaction-rules'
import {
  formatDomainValue,
  parseDomainValue,
  parseNumericText
} from '../../../src/renderer/src/lib/numeric-field'

describe('parseNumericText', () => {
  it('treats empty as empty', () => {
    expect(parseNumericText('')).toEqual({ kind: 'empty' })
    expect(parseNumericText('   ')).toEqual({ kind: 'empty' })
  })

  it('accepts intermediate-looking finished values', () => {
    expect(parseNumericText('3000')).toEqual({ kind: 'value', value: 3000 })
    expect(parseNumericText('3.')).toEqual({ kind: 'value', value: 3 })
    expect(parseNumericText('0.7')).toEqual({ kind: 'value', value: 0.7 })
  })

  it('rejects unparseable fragments cashiers might leave on blur', () => {
    expect(parseNumericText('-')).toEqual({ kind: 'invalid' })
    expect(parseNumericText('.')).toEqual({ kind: 'invalid' })
    expect(parseNumericText('abc')).toEqual({ kind: 'invalid' })
  })
})

describe('parseDomainValue / formatDomainValue money', () => {
  it('commits rupees to paise and formats back without ₹', () => {
    expect(parseDomainValue('money', '3000')).toEqual({ kind: 'value', value: 300_000 })
    expect(formatDomainValue('money', 300_000)).toBe('3000')
    expect(formatDomainValue('money', 1234)).toBe('12.34')
  })

  it('empty money is empty; invalid stays invalid', () => {
    expect(parseDomainValue('money', '')).toEqual({ kind: 'empty' })
    expect(parseDomainValue('money', '.')).toEqual({ kind: 'invalid' })
  })

  it('formatMoneyDomain trailing-zero strip does not mangle tens/hundreds', () => {
    // Guard against applying /\\.?0+$/ to bare integers (would turn "10"→"1").
    expect(formatDomainValue('money', 1000)).toBe('10')
    expect(formatDomainValue('money', 10_000)).toBe('100')
    expect(formatDomainValue('money', 1010)).toBe('10.1')
    expect(formatDomainValue('money', 10)).toBe('0.1')
  })
})

describe('parseDomainValue qty', () => {
  it('quantizes to one decimal place', () => {
    expect(parseDomainValue('qty', '3.7')).toEqual({ kind: 'value', value: 3.7 })
    expect(parseDomainValue('qty', '3.75')).toEqual({ kind: 'value', value: 3.8 })
  })

  it('1dp half-boundaries quantize and re-display without domain drift', () => {
    expect(parseDomainValue('qty', '3.05')).toEqual({ kind: 'value', value: 3.1 })
    expect(formatDomainValue('qty', 3.1)).toBe('3.1')
    expect(parseDomainValue('qty', formatDomainValue('qty', 3.1))).toEqual({
      kind: 'value',
      value: 3.1
    })
    expect(parseDomainValue('qty', '0.05')).toEqual({ kind: 'value', value: 0.1 })
  })
})

describe('NumericField parse → inventory line math', () => {
  it('bag line: typed qty+rate produce correct mass grams and total paise', () => {
    // 2.5 bags × 50 kg @ ₹6000/quintal → 125 kg = 1.25 q × 6000 = ₹7500
    const qty = (parseDomainValue('qty', '2.5') as { value: number }).value
    const rate = (parseDomainValue('money', '6000') as { value: number }).value
    expect(lineMassGrams({ isLoose: false, qty, bagSizeG: 50_000 })).toBe(125_000)
    expect(
      lineTotal({
        isLoose: false,
        qty,
        bagSizeG: 50_000,
        quintalRate: rate,
        perKgRate: null
      })
    ).toBe(750_000)
  })

  it('loose line: typed qty+rate produce correct mass grams and total paise', () => {
    // 3.7 kg × ₹100/kg = ₹370; mass 3700 g
    const qty = (parseDomainValue('qty', '3.7') as { value: number }).value
    const rate = (parseDomainValue('money', '100') as { value: number }).value
    expect(lineMassGrams({ isLoose: true, qty, bagSizeG: null })).toBe(3700)
    expect(
      lineTotal({
        isLoose: true,
        qty,
        bagSizeG: null,
        quintalRate: null,
        perKgRate: rate
      })
    ).toBe(37_000)
  })

  it('qty half-boundary feeds mass after quantize (3.05 bags → 3.1 × 50 kg)', () => {
    const qty = (parseDomainValue('qty', '3.05') as { value: number }).value
    expect(qty).toBe(3.1)
    expect(lineMassGrams({ isLoose: false, qty, bagSizeG: 50_000 })).toBe(155_000)
  })
})
