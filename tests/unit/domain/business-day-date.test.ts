import { describe, it, expect } from 'vitest'
import {
  assertValidBusinessDayStartDate,
  isValidIsoDate,
  localCalendarDate,
  planUpdateOpenStartDate
} from '../../../src/domain/business-day-date'

describe('localCalendarDate / isValidIsoDate', () => {
  it('formats local wall-clock date as YYYY-MM-DD', () => {
    expect(localCalendarDate(new Date(2026, 6, 19, 15, 30))).toBe('2026-07-19')
  })

  it('accepts real calendar days and rejects impossible ones', () => {
    expect(isValidIsoDate('2026-07-19')).toBe(true)
    expect(isValidIsoDate('2026-02-29')).toBe(false)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('19-07-2026')).toBe(false)
    expect(isValidIsoDate('2026-7-19')).toBe(false)
  })
})

describe('assertValidBusinessDayStartDate (shared next-day / edit rules)', () => {
  it('allows today when no prior day', () => {
    expect(() =>
      assertValidBusinessDayStartDate({
        startDate: '2026-07-19',
        today: '2026-07-19',
        priorStartDate: null
      })
    ).not.toThrow()
  })

  it('rejects dates before today', () => {
    expect(() =>
      assertValidBusinessDayStartDate({
        startDate: '2026-07-18',
        today: '2026-07-19',
        priorStartDate: null
      })
    ).toThrow(/before today/)
  })

  it('requires strictly after prior Business Day', () => {
    expect(() =>
      assertValidBusinessDayStartDate({
        startDate: '2026-07-19',
        today: '2026-07-19',
        priorStartDate: '2026-07-19'
      })
    ).toThrow(/after the previous Business Day/)
    expect(() =>
      assertValidBusinessDayStartDate({
        startDate: '2026-07-20',
        today: '2026-07-19',
        priorStartDate: '2026-07-19'
      })
    ).not.toThrow()
  })
})

describe('planUpdateOpenStartDate (empty open day)', () => {
  const base = {
    proposedStartDate: '2026-07-20',
    today: '2026-07-19',
    previousClosedStartDate: '2026-07-18' as string | null,
    finishedTxnCount: 0,
    draftCount: 0
  }

  it('empty day update OK — returns the proposed date', () => {
    expect(planUpdateOpenStartDate(base)).toBe('2026-07-20')
  })

  it('empty day with no previous closed day OK when ≥ today', () => {
    expect(
      planUpdateOpenStartDate({
        ...base,
        previousClosedStartDate: null,
        proposedStartDate: '2026-07-19'
      })
    ).toBe('2026-07-19')
  })

  it('with finished txn rejected', () => {
    expect(() => planUpdateOpenStartDate({ ...base, finishedTxnCount: 1 })).toThrow(
      /finished transactions/
    )
  })

  it('with Draft rejected (clear first)', () => {
    expect(() => planUpdateOpenStartDate({ ...base, draftCount: 2 })).toThrow(/Clear Drafts/)
  })

  it('rejects invalid or too-early dates', () => {
    expect(() => planUpdateOpenStartDate({ ...base, proposedStartDate: 'not-a-date' })).toThrow(
      /valid calendar date/
    )
    expect(() =>
      planUpdateOpenStartDate({
        ...base,
        proposedStartDate: '2026-07-17',
        previousClosedStartDate: null
      })
    ).toThrow(/before today/)
  })
})
