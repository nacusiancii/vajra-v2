/**
 * Loading Charge price-level grouping (integer paise / grams).
 */
import { describe, it, expect } from 'vitest'
import {
  loadingChargePriceLevels,
  loadingPriceLevelProductLabel,
  saleLoadingBreakdown
} from '@domain/loading-charge-levels'
import { DEFAULT_LOADING_CHARGE } from '@domain/settings'
import { computeLoadingCharge } from '@domain/transaction-rules'

const defaultRules = DEFAULT_LOADING_CHARGE

describe('loadingChargePriceLevels — breakpoint grouping', () => {
  it('merges 4×25 kg + 1×30 kg into one ≤30 level (count 5)', () => {
    const levels = loadingChargePriceLevels(
      [
        { isLoose: false, bagSizeG: 25_000, qty: 4 },
        { isLoose: false, bagSizeG: 30_000, qty: 1 }
      ],
      defaultRules
    )
    expect(levels).toEqual([
      {
        key: { kind: 'upTo', upToKg: 30 },
        count: 5,
        chargePerParcel: 1_000,
        amountPaise: 5_000
      }
    ])
  })

  it('splits 4×25 kg + 1×50 kg into ≤30 and above', () => {
    const levels = loadingChargePriceLevels(
      [
        { isLoose: false, bagSizeG: 25_000, qty: 4 },
        { isLoose: false, bagSizeG: 50_000, qty: 1 }
      ],
      defaultRules
    )
    expect(levels).toEqual([
      {
        key: { kind: 'upTo', upToKg: 30 },
        count: 4,
        chargePerParcel: 1_000,
        amountPaise: 4_000
      },
      {
        key: { kind: 'above' },
        count: 1,
        chargePerParcel: 1_200,
        amountPaise: 1_200
      }
    ])
  })

  it('omits a Loose 8 kg cart (zero-charge ≤10 dropped)', () => {
    expect(
      loadingChargePriceLevels([{ isLoose: true, bagSizeG: null, qty: 8 }], defaultRules)
    ).toEqual([])
  })

  it('keeps only above when Loose 8 kg is paired with 1×50 kg', () => {
    const levels = loadingChargePriceLevels(
      [
        { isLoose: true, bagSizeG: null, qty: 8 },
        { isLoose: false, bagSizeG: 50_000, qty: 1 }
      ],
      defaultRules
    )
    expect(levels).toEqual([
      {
        key: { kind: 'above' },
        count: 1,
        chargePerParcel: 1_200,
        amountPaise: 1_200
      }
    ])
  })

  it('merges 2×25 kg bags with Loose 20 kg into one ≤30 level (count 3)', () => {
    const levels = loadingChargePriceLevels(
      [
        { isLoose: false, bagSizeG: 25_000, qty: 2 },
        { isLoose: true, bagSizeG: null, qty: 20 }
      ],
      defaultRules
    )
    expect(levels).toEqual([
      {
        key: { kind: 'upTo', upToKg: 30 },
        count: 3,
        chargePerParcel: 1_000,
        amountPaise: 3_000
      }
    ])
  })
})

describe('saleLoadingBreakdown — none / levels / lump', () => {
  it('returns none when stored loadingCharges is 0 even if lines exist', () => {
    const lines = [{ isLoose: true, bagSizeG: null, qty: 8 }]
    expect(computeLoadingCharge(lines, defaultRules)).toBe(0)
    expect(saleLoadingBreakdown(lines, 0, defaultRules)).toEqual({ kind: 'none' })
  })

  it('returns lump when 1×50 kg stored ₹10 vs default ₹12', () => {
    expect(
      saleLoadingBreakdown([{ isLoose: false, bagSizeG: 50_000, qty: 1 }], 1_000, defaultRules)
    ).toEqual({ kind: 'lump' })
  })

  it('returns levels with one above row when 1×50 kg stored ₹12 matches defaults', () => {
    expect(
      saleLoadingBreakdown([{ isLoose: false, bagSizeG: 50_000, qty: 1 }], 1_200, defaultRules)
    ).toEqual({
      kind: 'levels',
      levels: [
        {
          key: { kind: 'above' },
          count: 1,
          chargePerParcel: 1_200,
          amountPaise: 1_200
        }
      ]
    })
  })
})

describe('loadingPriceLevelProductLabel', () => {
  it('formats the shopkeeper ≤30 and above examples', () => {
    expect(
      loadingPriceLevelProductLabel({
        key: { kind: 'upTo', upToKg: 30 },
        count: 5,
        chargePerParcel: 1_000,
        amountPaise: 5_000
      })
    ).toBe('5 × ₹10 (≤30 kg)')
    expect(
      loadingPriceLevelProductLabel({
        key: { kind: 'above' },
        count: 1,
        chargePerParcel: 1_200,
        amountPaise: 1_200
      })
    ).toBe('1 × ₹12 (above)')
  })
})
