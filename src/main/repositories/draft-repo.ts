import type { Database } from 'better-sqlite3'
import {
  draftCapExceededMessage,
  validatePurchaseDraftCounterparty,
  validateSaleDraftCounterparty,
  type Draft,
  type DraftCartFields,
  type DraftPayload,
  type DraftType,
  type PurchaseDraftPayload,
  type SaleDraftPayload,
  type SavePurchaseDraftInput,
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
    const reason = validateSaleDraftCounterparty(input.payload)
    if (reason) throw new Error(reason)
    return this.save('SA', input.id ?? null, input.payload)
  }

  savePurchase(input: SavePurchaseDraftInput): Draft {
    const reason = validatePurchaseDraftCounterparty(input.payload)
    if (reason) throw new Error(reason)
    return this.save('PU', input.id ?? null, input.payload)
  }

  clear(id: number): void {
    const result = this.db
      .prepare(`DELETE FROM draft WHERE id = ? AND business_day_id = ?`)
      .run(id, this.currentDayId())
    if (result.changes === 0) throw new Error('Draft not found')
  }

  private save(type: DraftType, existingId: number | null, payload: DraftPayload): Draft {
    const dayId = this.currentDayId()

    if (existingId != null) {
      const existing = this.getById(existingId)
      if (!existing) throw new Error('Draft not found')
      if (existing.type !== type) {
        throw new Error(
          type === 'SA' ? 'Draft is not a Sale Draft' : 'Draft is not a Purchase Draft'
        )
      }
      this.db
        .prepare(
          `UPDATE draft SET payload = ?, updated_at = datetime('now')
           WHERE id = ? AND business_day_id = ?`
        )
        .run(JSON.stringify(payload), existingId, dayId)
      return this.requireById(existingId)
    }

    const cap = this.draftCap()
    if (this.count() >= cap) throw new Error(draftCapExceededMessage(cap))

    const result = this.db
      .prepare(`INSERT INTO draft (business_day_id, type, payload) VALUES (?, ?, ?)`)
      .run(dayId, type, JSON.stringify(payload))
    return this.requireById(Number(result.lastInsertRowid))
  }

  private requireById(id: number): Draft {
    const draft = this.getById(id)
    if (!draft) throw new Error('Draft not found')
    return draft
  }

  private hydrate(row: DraftRow): Draft {
    const raw = JSON.parse(row.payload) as DraftPayload
    const counterparty = this.counterpartyDisplay(raw)
    const base = {
      id: row.id,
      businessDayId: row.business_day_id,
      counterpartyLabel: counterparty.label,
      counterpartyLabelTe: counterparty.labelTe,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
    if (row.type === 'SA') {
      return { ...base, type: 'SA', payload: raw as SaleDraftPayload }
    }
    return { ...base, type: 'PU', payload: raw as PurchaseDraftPayload }
  }

  private counterpartyDisplay(payload: DraftCartFields): {
    label: string
    labelTe: string | null
  } {
    if (payload.counterpartyMode === 'customer' && payload.customerId != null) {
      const c = this.db
        .prepare(`SELECT name, name_te FROM customer WHERE id = ?`)
        .get(payload.customerId) as { name: string; name_te: string | null } | undefined
      return {
        label: c?.name ?? `Customer #${payload.customerId}`,
        labelTe: c?.name_te?.trim() || null
      }
    }
    const name = payload.walkinName.trim()
    const place = payload.walkinPlace.trim()
    const label = name && place ? `${name} (${place})` : name || place || '—'
    return { label, labelTe: null }
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
