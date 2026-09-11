import type { Database } from 'better-sqlite3'
import {
  displayJournalSerial,
  journalNameMatchesCustomer,
  parseCreateJournalInput,
  type CreateJournalInput,
  type Journal,
  type JournalLeg
} from '../../domain/journal'

interface JournalRow {
  id: number
  seq: number
  rev: number
  debit_name: string | null
  debit_amount: number | null
  debit_customer_id: number | null
  credit_name: string | null
  credit_amount: number | null
  credit_customer_id: number | null
  remarks: string | null
  voided: number
  successor_id: number | null
  created_at: string
  successor_seq: number | null
  successor_rev: number | null
}

const JOURNAL_SELECT = `
  SELECT j.*, s.seq AS successor_seq, s.rev AS successor_rev
  FROM journal j
  LEFT JOIN journal s ON s.id = j.successor_id
`

/**
 * Day-scoped Journal store outside `txn` / `txn_line` (ADR-0011).
 * Writes do not bump `ledger_generation`. Edit is Void+Successor; Cancel voids
 * the live tip without a successor.
 */
export class JournalRepo {
  constructor(private db: Database) {}

  list(): Journal[] {
    const rows = this.db
      .prepare(
        `${JOURNAL_SELECT}
         WHERE j.business_day_id = ?
         ORDER BY j.created_at DESC, j.id DESC`
      )
      .all(this.currentDayId()) as JournalRow[]
    return rows.map((r) => this.hydrate(r))
  }

  get(id: number): Journal | null {
    const row = this.db
      .prepare(
        `${JOURNAL_SELECT}
         WHERE j.id = ? AND j.business_day_id = ?`
      )
      .get(id, this.currentDayId()) as JournalRow | undefined
    return row ? this.hydrate(row) : null
  }

  create(input: CreateJournalInput, inherit?: { seq: number; rev: number }): Journal {
    const parsed = parseCreateJournalInput(input)
    const debit = this.resolveLeg(parsed.debit)
    const credit = this.resolveLeg(parsed.credit)
    const dayId = this.currentDayId()
    const insert = this.db.transaction(() => {
      const seq = inherit?.seq ?? this.nextSeq(dayId)
      const rev = inherit?.rev ?? 0
      const result = this.db
        .prepare(
          `INSERT INTO journal (
             business_day_id, seq, rev,
             debit_name, debit_amount, debit_customer_id,
             credit_name, credit_amount, credit_customer_id,
             remarks
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          dayId,
          seq,
          rev,
          debit?.name ?? null,
          debit?.amount ?? null,
          debit?.customerId ?? null,
          credit?.name ?? null,
          credit?.amount ?? null,
          credit?.customerId ?? null,
          parsed.remarks
        )
      return Number(result.lastInsertRowid)
    })
    const created = this.get(insert())
    if (!created) throw new Error('Journal not found')
    return created
  }

  edit(id: number, input: CreateJournalInput): Journal {
    const original = this.get(id)
    if (!original) throw new Error('Journal not found')
    if (original.voided) throw new Error('Already-voided Journals cannot be edited (ADR-0007)')
    const tx = this.db.transaction(() => {
      const successor = this.create(input, { seq: original.seq, rev: original.rev + 1 })
      this.db
        .prepare(`UPDATE journal SET voided = 1, successor_id = ? WHERE id = ?`)
        .run(successor.id, id)
      return successor
    })
    return tx()
  }

  cancel(id: number): void {
    const original = this.get(id)
    if (!original) throw new Error('Journal not found')
    if (original.voided) throw new Error('Already-voided Journals cannot be cancelled')
    this.db.prepare(`UPDATE journal SET voided = 1, successor_id = NULL WHERE id = ?`).run(id)
  }

  private nextSeq(dayId: number): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM journal WHERE business_day_id = ?`)
      .get(dayId) as { n: number }
    return row.n
  }

  private resolveLeg(leg: JournalLeg | null): JournalLeg | null {
    if (!leg) return null
    const name = leg.name.trim()
    if (leg.customerId == null) {
      return { name, amount: leg.amount, customerId: null }
    }
    const row = this.db.prepare(`SELECT name FROM customer WHERE id = ?`).get(leg.customerId) as
      | { name: string }
      | undefined
    if (!row || !journalNameMatchesCustomer(name, row.name)) {
      return { name, amount: leg.amount, customerId: null }
    }
    return { name, amount: leg.amount, customerId: leg.customerId }
  }

  private hydrate(row: JournalRow): Journal {
    return {
      id: row.id,
      seq: row.seq,
      rev: row.rev,
      debit: hydrateLeg(row.debit_name, row.debit_amount, row.debit_customer_id),
      credit: hydrateLeg(row.credit_name, row.credit_amount, row.credit_customer_id),
      remarks: row.remarks,
      voided: row.voided === 1,
      successorId: row.successor_id,
      successorSerial:
        row.successor_id != null && row.successor_seq != null
          ? displayJournalSerial({ seq: row.successor_seq, rev: row.successor_rev ?? 0 })
          : null,
      createdAt: row.created_at
    }
  }

  private currentDayId(): number {
    const row = this.db.prepare(`SELECT id FROM business_day WHERE status = 'open'`).get() as
      | { id: number }
      | undefined
    if (!row) throw new Error('No open Business Day')
    return row.id
  }
}

function hydrateLeg(
  name: string | null,
  amount: number | null,
  customerId: number | null
): JournalLeg | null {
  if (name == null || amount == null) return null
  return { name, amount, customerId }
}
