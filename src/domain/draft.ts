/**
 * Draft Transactions — day-scoped parked carts outside the ledger (ADR-0010).
 *
 * A Draft is unfinished Sale/Purchase cart state. It never receives a Sale Number
 * or Voucher Number, never enters Inventory or drawer totals, and is free to
 * overwrite or delete. Finish goes through the normal create path, then the
 * Draft is dropped.
 *
 * Payload money fields are **paise**; bag sizes are **grams** (same as the ledger).
 */

import type { SaleMode } from './transaction'

/** Only Sales and Purchases are draftable. */
export type DraftType = 'SA' | 'PU'

/** Cart line while parked — rates/qty may still be empty. */
export interface DraftCartLine {
  productId: number | null
  /** Loose bulk: qty in kg, unitRate is paise/kg. */
  isLoose: boolean
  bagSizeG: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number | null
}

/** Shared cart fields on every Draft payload. */
export interface DraftCartFields {
  mode: SaleMode
  counterpartyMode: 'customer' | 'walkin'
  customerId: number | null
  walkinName: string
  walkinPlace: string
  walkinPhone: string
  lines: DraftCartLine[]
  additionalCharges: number | null
  upiCollected: number | null
  remarks: string
}

/** Sale cart snapshot — includes Loading Charge toggle. */
export interface SaleDraftPayload extends DraftCartFields {
  applyLoading: boolean
}

/** Purchase cart snapshot (no Loading Charges). */
export type PurchaseDraftPayload = DraftCartFields

export type DraftPayload = SaleDraftPayload | PurchaseDraftPayload

interface DraftRowBase {
  id: number
  businessDayId: number
  /** Human label for list UIs (Customer name or walk-in name). */
  counterpartyLabel: string
  /** Telugu name when the counterparty is a Customer Master entry that has one. */
  counterpartyLabelTe: string | null
  createdAt: string
  updatedAt: string
}

/** Full Draft row returned to the renderer — type narrows payload. */
export type Draft =
  | (DraftRowBase & { type: 'SA'; payload: SaleDraftPayload })
  | (DraftRowBase & { type: 'PU'; payload: PurchaseDraftPayload })

/** Create or overwrite a Sale Draft. `id` present = update existing. */
export interface SaveSaleDraftInput {
  id?: number | null
  payload: SaleDraftPayload
}

/** Create or overwrite a Purchase Draft. `id` present = update existing. */
export interface SavePurchaseDraftInput {
  id?: number | null
  payload: PurchaseDraftPayload
}

/**
 * Counterparty required before parking a Sale (CONTEXT.md / ADR-0010):
 * Customer Master entry, or walk-in name + place on Cash Sale.
 * Credit Sales always need a Customer Master entry (no walk-ins).
 * Returns a human-readable reason, or null when save is allowed.
 */
export function validateSaleDraftCounterparty(payload: SaleDraftPayload): string | null {
  if (payload.mode === 'credit') {
    if (payload.counterpartyMode === 'walkin' || payload.customerId == null) {
      return 'Save Draft needs a Customer Master entry'
    }
    return null
  }
  return validateWalkinOrCustomer(payload)
}

/**
 * Counterparty required before parking a Purchase (CONTEXT.md / ADR-0010):
 * Customer Master entry, or walk-in name + place (walk-ins allowed on Cash and Credit).
 * Returns a human-readable reason, or null when save is allowed.
 */
export function validatePurchaseDraftCounterparty(payload: PurchaseDraftPayload): string | null {
  return validateWalkinOrCustomer(payload)
}

function validateWalkinOrCustomer(payload: DraftCartFields): string | null {
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
  return `Draft limit reached (${cap}). Clear a Draft or increase the limit in Settings to save more.`
}
