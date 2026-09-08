/**
 * Journal — day-scoped notes outside the transactional ledger (ADR-0011).
 *
 * Own table, own sequence, own Void+Successor Edit. Not a TxnType. Does not
 * feed Inventory, drawer, credit totals, print, or this slice's End of Day Report.
 */

import { z } from 'zod'
import type { Txn } from './transaction'

export interface JournalLeg {
  name: string
  amount: number
  customerId: number | null
}

export interface Journal {
  id: number
  seq: number
  rev: number
  debit: JournalLeg | null
  credit: JournalLeg | null
  remarks: string | null
  voided: boolean
  /** Integer PK of the successor row; null on live tips and on cancelled (void-without-successor) rows. */
  successorId: number | null
  /** Display serial of the successor when voided-with-successor (`J-4.1`); null otherwise. Hydrated at read. */
  successorSerial: string | null
  createdAt: string
}

export interface CreateJournalInput {
  debit: JournalLeg | null
  credit: JournalLeg | null
  remarks: string | null
}

/** Day-list view model. Must not be passed to summariseDrawer / EOD / inventory. */
export type DayEntry =
  | { kind: 'txn'; createdAt: string; id: string; txn: Txn }
  | { kind: 'journal'; createdAt: string; id: string; journal: Journal }

export function displayJournalSerial(j: Pick<Journal, 'seq' | 'rev'>): string {
  return j.rev > 0 ? `J-${j.seq}.${j.rev}` : `J-${j.seq}`
}

export function mergeDayList(txns: Txn[], journals: Journal[]): DayEntry[] {
  const rows: DayEntry[] = [
    ...txns.map((txn) => ({
      kind: 'txn' as const,
      createdAt: txn.createdAt,
      id: txn.id,
      txn
    })),
    ...journals.map((journal) => ({
      kind: 'journal' as const,
      createdAt: journal.createdAt,
      id: `journal:${journal.id}`,
      journal
    }))
  ]
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
}

export function txnsFromDayEntries(entries: DayEntry[]): Txn[] {
  return entries
    .filter((e): e is Extract<DayEntry, { kind: 'txn' }> => e.kind === 'txn')
    .map((e) => e.txn)
}

/** Trim + case-insensitive match against that selected Customer's English name. */
export function journalNameMatchesCustomer(journalName: string, customerName: string): boolean {
  return journalName.trim().toLowerCase() === customerName.trim().toLowerCase()
}

function isBlankAmount(amount: unknown): boolean {
  return amount == null || amount === '' || amount === 0
}

/** Empty name AND blank amount → drop the leg (and any customerId). Otherwise keep a candidate. */
function preprocessLeg(raw: unknown): unknown {
  if (raw == null) return null
  if (typeof raw !== 'object') return raw
  const o = raw as { name?: unknown; amount?: unknown }
  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (name === '' && isBlankAmount(o.amount)) return null
  return raw
}

const JournalLegSchema = z.object({
  name: z.string().trim().min(1, 'Enter a party.'),
  amount: z.coerce
    .number({ invalid_type_error: 'Enter an amount.', required_error: 'Enter an amount.' })
    .int('Enter an amount.')
    .positive('Enter an amount.'),
  customerId: z.number().int().nullable().default(null)
})

export const CreateJournalSchema = z
  .object({
    debit: z.preprocess(preprocessLeg, JournalLegSchema.nullable()),
    credit: z.preprocess(preprocessLeg, JournalLegSchema.nullable()),
    remarks: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable()
  })
  .refine((v) => v.debit != null || v.credit != null, {
    message: 'Enter a debit or a credit.'
  })

export function parseCreateJournalInput(input: unknown): CreateJournalInput {
  return CreateJournalSchema.parse(input)
}
