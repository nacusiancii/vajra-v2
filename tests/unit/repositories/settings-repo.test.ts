/**
 * Settings write-boundary for Loading Charge breakpoints.
 * `normalizeLoadingCharge` is what SettingsRepo.update calls before persist.
 * (better-sqlite3 is Electron-native — no in-process DB in vitest.)
 */
import { describe, it, expect } from 'vitest'
import { normalizeLoadingCharge } from '../../../src/main/repositories/settings-repo'

describe('SettingsRepo / normalizeLoadingCharge', () => {
  it('sorts breakpoints ascending and accepts valid rules', () => {
    const normalized = normalizeLoadingCharge({
      breakpoints: [
        { upToKg: 30, chargePaise: 1_000 },
        { upToKg: 10, chargePaise: 0 }
      ],
      aboveLastPaise: 1_200
    })
    expect(normalized.breakpoints).toEqual([
      { upToKg: 10, chargePaise: 0 },
      { upToKg: 30, chargePaise: 1_000 }
    ])
    expect(normalized.aboveLastPaise).toBe(1_200)
  })

  it('rejects negative chargePaise', () => {
    expect(() =>
      normalizeLoadingCharge({
        breakpoints: [{ upToKg: 10, chargePaise: -1 }],
        aboveLastPaise: 0
      })
    ).toThrow(/chargePaise/)
  })

  it('rejects non-integer aboveLastPaise', () => {
    expect(() =>
      normalizeLoadingCharge({
        breakpoints: [{ upToKg: 10, chargePaise: 0 }],
        aboveLastPaise: 12.5
      })
    ).toThrow(/aboveLastPaise/)
  })

  it('rejects duplicate upToKg', () => {
    expect(() =>
      normalizeLoadingCharge({
        breakpoints: [
          { upToKg: 10, chargePaise: 0 },
          { upToKg: 10, chargePaise: 500 }
        ],
        aboveLastPaise: 1_200
      })
    ).toThrow(/Duplicate/)
  })

  it('rejects non-positive upToKg', () => {
    expect(() =>
      normalizeLoadingCharge({
        breakpoints: [{ upToKg: 0, chargePaise: 0 }],
        aboveLastPaise: 0
      })
    ).toThrow(/upToKg/)
  })
})
