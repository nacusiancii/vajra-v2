/**
 * Draft Transactions — day-scoped parked carts outside the ledger (ADR-0010).
 *
 * A Draft is unfinished Sale/Purchase cart state. It never receives a Sale Number
 * or Voucher Number, never enters Inventory or drawer totals, and is free to
 * overwrite or delete. Finish goes through the normal create path, then the
 * Draft is dropped.
 */

import type { SaleMode } from './transaction'

/** Only Sales and Purchases are draftable. */
export type DraftType = 'SA' | 'PU'

/** Cart line while parked — rates/qty may still be empty. */
export interface DraftCartLine {
  productId: number | null
  bagSizeKg: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number | null
}

/** Sale cart snapshot stored as the Draft payload. */
export interface SaleDraftPayload {
  mode: SaleMode
  counterpartyMode: 'customer' | 'walkin'
  customerId: number | null
  walkinName: string
  walkinPlace: string
  walkinPhone: string
  lines: DraftCartLine[]
  applyLoading: boolean
  additionalCharges: number | null
  upiCollected: number | null
  remarks: string
}

/** Full Draft row returned to the renderer. */
export interface Draft {
  id: number
  type: DraftType
  businessDayId: number
  /** Human label for list UIs (Customer name or walk-in name). */
  counterpartyLabel: string
  payload: SaleDraftPayload
  createdAt: string
  updatedAt: string
}

/** Create or overwrite a Sale Draft. `id` present = update existing. */
export interface SaveSaleDraftInput {
  id?: number | null
  payload: SaleDraftPayload
}

/**
 * Counterparty required before park (CONTEXT.md / ADR-0010): Customer Master
 * entry, or walk-in name + place on Cash Sale.
 * Returns a human-readable reason, or null when save is allowed.
 */
export function validateDraftCounterparty(payload: SaleDraftPayload): string | null {
  if (payload.mode === 'credit') {
    if (payload.counterpartyMode === 'walkin' || payload.customerId == null) {
      return 'Save Draft needs a Customer Master entry'
    }
    return null
  }
  if (payload.counterpartyMode === 'customer') {
    if (payload.customerId == null) {
      return 'Save Draft needs a Customer Master entry, or a walk-in name and place'
    }
    return null
  }
  if (!payload.walkinName.trim() || !payload.walkinPlace.trim()) {
    return 'Save Draft needs a walk-in name and place'
  }
  return null
}

/** Cap exceeded message — shared by repo and any thin unit tests. */
export function draftCapExceededMessage(cap: number): string {
  return `Draft limit reached (${cap}). Clear a Draft before saving another.`
}
