/**
 * Shared Edit navigation for finished transactions.
 * Edit is void + successor (ADR-0007); only live tips should call these helpers.
 */

import { TXN_TYPE_LABELS, type Txn, type TxnType } from '@domain/transaction'

export const TXN_EDIT_ROUTE: Record<TxnType, string> = {
  SA: '/sale',
  PU: '/purchase',
  ST: '/stock-transfer',
  RE: '/receipt',
  PA: '/payment',
  EX: '/expense',
  IN: '/income',
  JN: '/journal'
}

/** Route that opens the type-specific form prefilled for Edit. */
export function txnEditPath(t: Pick<Txn, 'type' | 'id'>): string {
  return `${TXN_EDIT_ROUTE[t.type]}?edit=${t.id}`
}

/** Display label for the counterparty column on Home / ledger lists. */
export function txnCounterparty(t: Pick<Txn, 'customerName' | 'walkinName' | 'label'>): string {
  return t.customerName ?? t.walkinName ?? t.label ?? '—'
}

/** Type column / Edit label: Journal carries Debit/Credit in the type text. */
export function txnTypeDisplay(t: Pick<Txn, 'type' | 'journalSide'>): string {
  if (t.type === 'JN') {
    if (t.journalSide === 'debit') return 'Journal Debit'
    if (t.journalSide === 'credit') return 'Journal Credit'
    return 'Journal'
  }
  return TXN_TYPE_LABELS[t.type]
}
