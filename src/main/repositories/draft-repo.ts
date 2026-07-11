import type { Database } from 'better-sqlite3'
import {
  draftCapExceededMessage,
  validateDraftCounterparty,
  type Draft,
  type DraftType,
  type SaleDraftPayload,
  type SaveSaleDraftInput
} from '../../domain/draft'
import { DEFAULT_SETTINGS } from '../../domain/settings'
import type { SettingsRepo } from './settings-repo'

interface DraftRow {
  id: number
  business_day_id: number
  type: DraftType
  payload: string
  created_at: string
  updated_at: string
}

/**
 * Day-scoped Draft store outside `txn` / `txn_line` (ADR-0010).
 * Sale + Purchase share one global cap; Finish never goes through this table.
 */
export class DraftRepo {
  constructor(
    private db: Database,
    private settings: SettingsRepo
  ) {}

  list(type?: DraftType): Draft[] {
    const dayId = this.currentDayId()
    const sql = type
      ? `SELECT * FROM draft WHERE business_day_id = ? AND type = ?
         ORDER BY updated_at DESC, id DESC`
      : `SELECT * FROM draft WHERE business_day_id = ?
         ORDER BY updated_at DESC, id DESC`
    const rows = (
      type ? this.db.prepare(sql).all(dayId, type) : this.db.prepare(sql).all(dayId)
    ) as DraftRow[]
    return rows.map((r) => this.hydrate(r))
  }

  getById(id: number): Draft | undefined {
    const row = this.db.prepare(`SELECT * FROM draft WHERE id = ?`).get(id) as DraftRow | undefined
    if (!row || row.business_day_id !== this.currentDayId()) return undefined
    return this.hydrate(row)
  }

  count(): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM draft WHERE business_day_id = ?`)
      .get(this.currentDayId()) as { n: number }
    return row.n
  }

  saveSale(input: SaveSaleDraftInput): Draft {
    const reason = validateDraftCounterparty(input.payload)
    if (reason) throw new Error(reason)

    const dayId = this.currentDayId()
    const existingId = input.id ?? null

    if (existingId != null) {
      const existing = this.getById(existingId)
      if (!existing) throw new Error('Draft not found')
      if (existing.type !== 'SA') throw new Error('Draft is not a Sale Draft')
      this.db
        .prepare(
          `UPDATE draft SET payload = ?, updated_at = datetime('now')
           WHERE id = ? AND business_day_id = ?`
        )
        .run(JSON.stringify(input.payload), existingId, dayId)
      return this.requireById(existingId)
    }

    const cap = this.draftCap()
    if (this.count() >= cap) throw new Error(draftCapExceededMessage(cap))

    const result = this.db
      .prepare(`INSERT INTO draft (business_day_id, type, payload) VALUES (?, 'SA', ?)`)
      .run(dayId, JSON.stringify(input.payload))
    return this.requireById(Number(result.lastInsertRowid))
  }

  clear(id: number): void {
    const result = this.db
      .prepare(`DELETE FROM draft WHERE id = ? AND business_day_id = ?`)
      .run(id, this.currentDayId())
    if (result.changes === 0) throw new Error('Draft not found')
  }

  private requireById(id: number): Draft {
    const draft = this.getById(id)
    if (!draft) throw new Error('Draft not found')
    return draft
  }

  private hydrate(row: DraftRow): Draft {
    const payload = JSON.parse(row.payload) as SaleDraftPayload
    return {
      id: row.id,
      type: row.type,
      businessDayId: row.business_day_id,
      counterpartyLabel: this.counterpartyLabel(payload),
      payload,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private counterpartyLabel(payload: SaleDraftPayload): string {
    if (payload.counterpartyMode === 'customer' && payload.customerId != null) {
      const c = this.db
        .prepare(`SELECT name FROM customer WHERE id = ?`)
        .get(payload.customerId) as { name: string } | undefined
      return c?.name ?? `Customer #${payload.customerId}`
    }
    const name = payload.walkinName.trim()
    const place = payload.walkinPlace.trim()
    if (name && place) return `${name} (${place})`
    return name || place || '—'
  }

  private currentDayId(): number {
    const row = this.db.prepare(`SELECT id FROM business_day WHERE status = 'open'`).get() as
      | { id: number }
      | undefined
    if (!row) throw new Error('No open Business Day')
    return row.id
  }

  private draftCap(): number {
    const cap = this.settings.get().draftCap
    return typeof cap === 'number' && cap > 0 ? Math.floor(cap) : DEFAULT_SETTINGS.draftCap
  }
}
