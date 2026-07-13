import { describe, expect, it } from 'vitest'
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
})

describe('parseDomainValue qty', () => {
  it('quantizes to one decimal place', () => {
    expect(parseDomainValue('qty', '3.7')).toEqual({ kind: 'value', value: 3.7 })
    expect(parseDomainValue('qty', '3.75')).toEqual({ kind: 'value', value: 3.8 })
  })
})
