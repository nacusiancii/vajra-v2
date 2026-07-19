import { describe, it, expect } from 'vitest'
import {
  addDays,
  isIsoDate,
  localToday,
  minNextBusinessDayStartDate,
  nextWorkingDayAfter,
  preselectNextBusinessDayStartDate,
  resolveNextBusinessDayStartDate,
  validateNextBusinessDayStartDate
} from '@domain/business-day'

describe('localToday', () => {
  it('formats a local Date as YYYY-MM-DD', () => {
    // Local noon avoids UTC day-boundary flakiness.
    const d = new Date(2026, 4, 31, 12, 0, 0)
    expect(localToday(d)).toBe('2026-05-31')
  })
})

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2026-05-31')).toBe(true)
    expect(isIsoDate('2026-02-28')).toBe(true)
  })

  it('rejects malformed or non-real dates', () => {
    expect(isIsoDate('2026-5-31')).toBe(false)
    expect(isIsoDate('31-05-2026')).toBe(false)
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('')).toBe(false)
  })
})

describe('addDays / nextWorkingDayAfter', () => {
  it('addDays rolls across months', () => {
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01')
  })

  it('next working day after Friday is Saturday', () => {
    // 2026-07-17 is a Friday
    expect(nextWorkingDayAfter('2026-07-17')).toBe('2026-07-18')
  })

  it('next working day after Saturday skips Sunday to Monday', () => {
    // 2026-07-18 is a Saturday
    expect(nextWorkingDayAfter('2026-07-18')).toBe('2026-07-20')
  })

  it('next working day after Sunday is Monday', () => {
    // 2026-07-19 is a Sunday
    expect(nextWorkingDayAfter('2026-07-19')).toBe('2026-07-20')
  })
})

describe('preselectNextBusinessDayStartDate', () => {
  it('preselects today when today is after the open day', () => {
    // Forgot to rollover: open day is yesterday
    expect(preselectNextBusinessDayStartDate('2026-07-17', '2026-07-18')).toBe('2026-07-18')
  })

  it('preselects next working day when today equals the open day', () => {
    // Same-evening rollover on Friday → Saturday
    expect(preselectNextBusinessDayStartDate('2026-07-17', '2026-07-17')).toBe('2026-07-18')
  })

  it('preselects Monday when rolling over on Saturday', () => {
    expect(preselectNextBusinessDayStartDate('2026-07-18', '2026-07-18')).toBe('2026-07-20')
  })

  it('preselects today even when today is Sunday (no hard Sunday ban)', () => {
    // Open day Friday, calendar Sunday → preselect Sunday
    expect(preselectNextBusinessDayStartDate('2026-07-17', '2026-07-19')).toBe('2026-07-19')
  })

  it('preselects next working day after a future open day', () => {
    // Open day is tomorrow; preselect day after that (working day)
    // 2026-07-20 Mon open, today 2026-07-19 Sun → next after open = Tue
    expect(preselectNextBusinessDayStartDate('2026-07-20', '2026-07-19')).toBe('2026-07-21')
  })
})

describe('minNextBusinessDayStartDate', () => {
  it('is day-after-current when that is still in the future relative to today', () => {
    expect(minNextBusinessDayStartDate('2026-07-17', '2026-07-17')).toBe('2026-07-18')
  })

  it('is today when today is already past day-after-current', () => {
    // Open 2026-07-15, today 2026-07-18 → min is today
    expect(minNextBusinessDayStartDate('2026-07-15', '2026-07-18')).toBe('2026-07-18')
  })
})

describe('validateNextBusinessDayStartDate', () => {
  const current = '2026-07-17'
  const today = '2026-07-17'

  it('accepts a date strictly after current and not before today', () => {
    expect(validateNextBusinessDayStartDate('2026-07-18', current, today)).toEqual({
      ok: true,
      startDate: '2026-07-18'
    })
  })

  it('accepts Sunday when constraints allow it', () => {
    // Current Fri, today Sat → Sunday is after current and after today? No, today Sat so Sun >= Sat ok
    expect(validateNextBusinessDayStartDate('2026-07-19', '2026-07-17', '2026-07-18')).toEqual({
      ok: true,
      startDate: '2026-07-19'
    })
  })

  it('rejects same as current', () => {
    const r = validateNextBusinessDayStartDate(current, current, today)
    expect(r.ok).toBe(false)
  })

  it('rejects before today', () => {
    // Current is older; candidate is after current but before today
    const r = validateNextBusinessDayStartDate('2026-07-16', '2026-07-15', '2026-07-18')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/today/)
  })

  it('rejects malformed dates', () => {
    expect(validateNextBusinessDayStartDate('not-a-date', current, today).ok).toBe(false)
  })
})

describe('resolveNextBusinessDayStartDate (approve path)', () => {
  it('returns the chosen date to store when valid', () => {
    // Approve path binds this string into business_day.start_date
    expect(resolveNextBusinessDayStartDate('2026-07-20', '2026-07-17', '2026-07-18')).toBe(
      '2026-07-20'
    )
  })

  it('throws when the chosen date violates constraints', () => {
    expect(() => resolveNextBusinessDayStartDate('2026-07-17', '2026-07-17', '2026-07-17')).toThrow(
      /after the current day/
    )
  })

  it('throws when the chosen date is before today', () => {
    expect(() => resolveNextBusinessDayStartDate('2026-07-16', '2026-07-15', '2026-07-18')).toThrow(
      /before today/
    )
  })
})
