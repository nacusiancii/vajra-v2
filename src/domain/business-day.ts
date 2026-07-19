/**
 * Business Day date helpers for Rollover next-day selection.
 * Dates are calendar YYYY-MM-DD strings in the local timezone.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Calendar today as YYYY-MM-DD in the local timezone. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** True when `value` looks like a calendar date YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [ys, ms, ds] = value.split('-')
  const y = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  // Reject non-real calendar dates (e.g. 2026-02-31).
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

/** Add `days` to an ISO date (local calendar arithmetic). */
export function addDays(isoDate: string, days: number): string {
  const [ys, ms, ds] = isoDate.split('-').map(Number) as [number, number, number]
  const dt = new Date(ys, ms - 1, ds)
  dt.setDate(dt.getDate() + days)
  return localToday(dt)
}

/**
 * Next Mon–Sat working day strictly after `isoDate` (skips Sunday only).
 * Used for preselect when the open Business Day is still "today" or later.
 */
export function nextWorkingDayAfter(isoDate: string): string {
  let candidate = addDays(isoDate, 1)
  // 0 = Sunday
  while (weekday(candidate) === 0) {
    candidate = addDays(candidate, 1)
  }
  return candidate
}

function weekday(isoDate: string): number {
  const [ys, ms, ds] = isoDate.split('-').map(Number) as [number, number, number]
  return new Date(ys, ms - 1, ds).getDay()
}

/**
 * Preselect the next Business Day startDate for Rollover approve.
 *
 * - If calendar today is after the open day's startDate → preselect today
 *   (shop forgot to rollover; continue from the wall clock).
 * - Else → preselect the next Mon–Sat working day after the open day's startDate
 *   (typical same-evening rollover; skip Sunday as a convenience default).
 *
 * The user may still pick any date that passes {@link validateNextBusinessDayStartDate},
 * including Sunday when constraints allow it.
 */
export function preselectNextBusinessDayStartDate(
  currentStartDate: string,
  today: string = localToday()
): string {
  if (today > currentStartDate) {
    return today
  }
  return nextWorkingDayAfter(currentStartDate)
}

/**
 * Earliest date the date picker may offer: max(day after current, today).
 * Pure helper for the UI `min` attribute.
 */
export function minNextBusinessDayStartDate(
  currentStartDate: string,
  today: string = localToday()
): string {
  const dayAfterCurrent = addDays(currentStartDate, 1)
  return dayAfterCurrent > today ? dayAfterCurrent : today
}

export type NextBusinessDayValidation =
  | { ok: true; startDate: string }
  | { ok: false; reason: string }

/**
 * Validate a chosen next Business Day startDate.
 * Constraints: valid ISO date, strictly after current open day, and not before calendar today.
 */
export function validateNextBusinessDayStartDate(
  nextStartDate: string,
  currentStartDate: string,
  today: string = localToday()
): NextBusinessDayValidation {
  if (!isIsoDate(nextStartDate)) {
    return { ok: false, reason: 'Next Business Day must be a calendar date (YYYY-MM-DD).' }
  }
  if (!isIsoDate(currentStartDate)) {
    return { ok: false, reason: 'Current Business Day startDate is invalid.' }
  }
  if (!isIsoDate(today)) {
    return { ok: false, reason: 'Calendar today is invalid.' }
  }
  if (nextStartDate <= currentStartDate) {
    return {
      ok: false,
      reason: `Next Business Day must be after the current day (${currentStartDate}).`
    }
  }
  if (nextStartDate < today) {
    return {
      ok: false,
      reason: `Next Business Day cannot be before today (${today}).`
    }
  }
  return { ok: true, startDate: nextStartDate }
}

/**
 * Assert validation for the approve path; returns the date to store.
 * Throws with a human-readable message on failure.
 */
export function resolveNextBusinessDayStartDate(
  nextStartDate: string,
  currentStartDate: string,
  today: string = localToday()
): string {
  const result = validateNextBusinessDayStartDate(nextStartDate, currentStartDate, today)
  if (!result.ok) {
    throw new Error(result.reason)
  }
  return result.startDate
}
