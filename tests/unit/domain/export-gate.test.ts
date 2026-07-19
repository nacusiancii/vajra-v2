/**
 * EOD export gate: ledger generation watermark + Approve unlock rules.
 * Pure state helpers — no SQLite (better-sqlite3 is Electron-native).
 */
import { describe, it, expect } from 'vitest'
import {
  bumpLedgerGeneration,
  canApproveRollover,
  initialExportGateState,
  recordExportSuccess
} from '@domain/transaction'

describe('export gate watermark', () => {
  it('starts locked: empty day (gen 0) still requires one export', () => {
    const state = initialExportGateState()
    expect(state).toEqual({ ledgerGeneration: 0, lastExportGeneration: null })
    expect(canApproveRollover(state)).toBe(false)
  })

  it('export of empty book unlocks Approve', () => {
    let state = initialExportGateState()
    state = recordExportSuccess(state)
    expect(state.lastExportGeneration).toBe(0)
    expect(canApproveRollover(state)).toBe(true)
  })

  it('finished ledger mutation re-locks after a fresh export', () => {
    let state = initialExportGateState()
    state = recordExportSuccess(state)
    expect(canApproveRollover(state)).toBe(true)

    state = bumpLedgerGeneration(state)
    expect(state.ledgerGeneration).toBe(1)
    expect(state.lastExportGeneration).toBe(0)
    expect(canApproveRollover(state)).toBe(false)
  })

  it('export after mutation unlocks again', () => {
    let state = initialExportGateState()
    state = bumpLedgerGeneration(state)
    state = bumpLedgerGeneration(state)
    expect(canApproveRollover(state)).toBe(false)

    state = recordExportSuccess(state)
    expect(state).toEqual({ ledgerGeneration: 2, lastExportGeneration: 2 })
    expect(canApproveRollover(state)).toBe(true)
  })

  it('stale export generation never unlocks when generations diverge', () => {
    expect(canApproveRollover({ ledgerGeneration: 3, lastExportGeneration: 2 })).toBe(false)
    expect(canApproveRollover({ ledgerGeneration: 3, lastExportGeneration: null })).toBe(false)
    expect(canApproveRollover({ ledgerGeneration: 3, lastExportGeneration: 3 })).toBe(true)
  })
})
