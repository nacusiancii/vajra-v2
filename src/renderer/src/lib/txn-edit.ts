/**
 * Shared Edit navigation for finished transactions.
 * Edit is void + successor (ADR-0007); only live tips should call these helpers.
 */

import type { Txn, TxnType } from '@domain/transaction'

export const TXN_EDIT_ROUTE: Record<TxnType, string> = {
  SA: '/sale',
  PU: '/purchase',
  ST: '/stock-transfer',
  RE: '/receipt',
  PA: '/payment',
  EX: '/expense',
  IN: '/income'
}

/** Route that opens the type-specific form prefilled for Edit. */
export function txnEditPath(t: Pick<Txn, 'type' | 'id'>): string {
  return `${TXN_EDIT_ROUTE[t.type]}?edit=${t.id}`
}

/** Display label for the counterparty column on Home / ledger lists. */
export function txnCounterparty(t: Pick<Txn, 'customerName' | 'walkinName' | 'label'>): string {
  return t.customerName ?? t.walkinName ?? t.label ?? '—'
}
