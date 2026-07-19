/**
 * Calendar-date rules for Business Day startDate (YYYY-MM-DD, local wall clock).
 *
 * Shared product constraints (align next-biz-day on Rollover approve with edit-empty-day):
 * - Valid ISO calendar date
 * - New startDate must be ≥ local calendar today
 * - New startDate must be > the prior Business Day's startDate when known
 *   (for next-day: current open day; for empty open-day edit: previous closed day)
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Local wall-clock calendar date as YYYY-MM-DD. */
export function localCalendarDate(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** True when `s` is a real calendar day in YYYY-MM-DD form. */
export function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

export interface ValidateStartDateArgs {
  /** Proposed Business Day startDate (YYYY-MM-DD). */
  startDate: string
  /** Local calendar today (YYYY-MM-DD). Inject for tests. */
  today: string
  /**
   * Prior Business Day startDate that the new date must strictly exceed.
   * - Next-day on approve: current open day's startDate
   * - Edit empty open day: previous closed day's startDate, or null if none
   */
  priorStartDate: string | null
}

/**
 * Validates a candidate Business Day startDate against product date rules.
 * Throws Error with a cashier-facing message on failure.
 */
export function assertValidBusinessDayStartDate(args: ValidateStartDateArgs): void {
  const { startDate, today, priorStartDate } = args
  if (!isValidIsoDate(startDate)) {
    throw new Error('Business Day date must be a valid calendar date (YYYY-MM-DD)')
  }
  if (!isValidIsoDate(today)) {
    throw new Error('Internal error: invalid today date')
  }
  if (startDate < today) {
    throw new Error('Business Day date cannot be before today')
  }
  if (priorStartDate != null) {
    if (!isValidIsoDate(priorStartDate)) {
      throw new Error('Internal error: invalid prior Business Day date')
    }
    if (startDate <= priorStartDate) {
      throw new Error(
        `Business Day date must be after the previous Business Day (${priorStartDate})`
      )
    }
  }
}

export interface PlanUpdateOpenStartDateArgs {
  proposedStartDate: string
  today: string
  /** Previous closed Business Day startDate, if any. */
  previousClosedStartDate: string | null
  /** Finished txn row count for the open day (voided included). */
  finishedTxnCount: number
  /** Draft row count for the open day. */
  draftCount: number
}

/**
 * Pure plan for changing the open Business Day's startDate when the day is empty.
 * Returns the normalised date to persist, or throws a cashier-facing Error.
 *
 * Rules:
 * - Block when any finished txn exists
 * - Block when any Draft exists (clear Drafts first)
 * - Date: ≥ today; > previous closed startDate when known
 */
export function planUpdateOpenStartDate(args: PlanUpdateOpenStartDateArgs): string {
  if (args.finishedTxnCount > 0) {
    throw new Error('Cannot change the Business Day date after finished transactions exist')
  }
  if (args.draftCount > 0) {
    throw new Error('Clear Drafts before changing the Business Day date')
  }
  assertValidBusinessDayStartDate({
    startDate: args.proposedStartDate,
    today: args.today,
    priorStartDate: args.previousClosedStartDate
  })
  return args.proposedStartDate
}
