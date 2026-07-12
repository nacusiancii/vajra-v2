import { describe, it, expect } from 'vitest'
import {
  bulkLineTotalPaise,
  bulkStockDeltaG,
  gToKg,
  kgToG,
  lineMassG,
  paiseToRupees,
  roundHalfAway,
  rupeesToPaise,
  stockGToDefaultBags
} from '@domain/units'

describe('money paise', () => {
  it('round-trips whole rupees', () => {
    expect(rupeesToPaise(12.34)).toBe(1234)
    expect(paiseToRupees(1234)).toBe(12.34)
  })

  it('rounds half away on convert', () => {
    expect(rupeesToPaise(10.005)).toBe(1001)
  })
})

describe('mass grams', () => {
  it('converts bag sizes', () => {
    expect(kgToG(50)).toBe(50_000)
    expect(gToKg(25_000)).toBe(25)
  })

  it('line mass and stock are exact for half bags', () => {
    expect(lineMassG(0.5, 50_000)).toBe(25_000)
    expect(bulkStockDeltaG(1, 25_000, -1)).toBe(-25_000)
  })

  it('display bags from grams', () => {
    expect(stockGToDefaultBags(150_000, 50_000)).toBe(3)
    expect(stockGToDefaultBags(25_000, 50_000)).toBe(0.5)
  })
})

describe('bulk pricing', () => {
  it('1 quintal at ₹6000 is 600000 paise', () => {
    // 2 × 50kg = 100kg
    expect(bulkLineTotalPaise(100_000, 600_000)).toBe(600_000)
  })

  it('rounds line totals to whole paise', () => {
    // mass that produces a half-paise intermediate should round
    expect(roundHalfAway(1.5)).toBe(2)
    expect(roundHalfAway(-1.5)).toBe(-2)
  })
})
