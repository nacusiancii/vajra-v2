/**
 * Domain types and the shared projection library for Vajra's transactional core.
 *
 * Uses the glossary from CONTEXT.md exactly. The functions here are pure — they are
 * the single source of truth for stock deltas and the Inventory projection (ADR-0005),
 * shared by the repository (write time), the live UI, and the End of Day Report.
 */

import type { ProductType } from './types'

/** Two-letter transaction-type codes — a closed set (ADR-0009). */
export type TxnType = 'SA' | 'PU' | 'RE' | 'PA' | 'EX' | 'IN' | 'ST'

export const TXN_TYPE_LABELS: Record<TxnType, string> = {
  SA: 'Sale',
  PU: 'Purchase',
  RE: 'Receipt',
  PA: 'Payment',
  EX: 'Expense',
  IN: 'Income',
  ST: 'Stock Transfer'
}

export type SaleMode = 'cash' | 'credit'
export type TxnLineSide = 'single' | 'source' | 'target'

// ── Read models (returned by the repository) ─────────────────────────────────

export interface TxnLine {
  id: number
  productId: number
  productName: string
  productType: ProductType
  side: TxnLineSide
  bagSizeKg: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number
  stockDelta: number
  lineTotal: number
}

export interface Txn {
  id: string
  type: TxnType
  seq: number
  voucherSeq: number | null
  saleMode: SaleMode | null
  customerId: number | null
  customerName: string | null
  walkinName: string | null
  walkinPlace: string | null
  walkinPhone: string | null
  label: string | null
  cashIn: number
  upiIn: number
  cashOut: number
  upiOut: number
  additionalCharges: number
  loadingCharges: number
  total: number
  creditAmount: number
  remarks: string | null
  voided: boolean
  successorId: string | null
  createdAt: string
  lines: TxnLine[]
}

export interface BusinessDay {
  id: number
  startDate: string // YYYY-MM-DD
  status: 'open' | 'closed'
  openedAt: string
  closedAt: string | null
}

// ── Create inputs ────────────────────────────────────────────────────────────

export interface SaleLineInput {
  productId: number
  bagSizeKg: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number
}

export interface WalkinInput {
  name: string
  place: string
  phone: string | null
}

export interface CreateSaleInput {
  mode: SaleMode
  customerId: number | null
  walkin: WalkinInput | null
  lines: SaleLineInput[]
  additionalCharges: number
  loadingCharges: number
  cashCollected: number
  upiCollected: number
  remarks: string | null
}

export interface CreatePurchaseInput {
  /** Cash pays the supplier now (cash/UPI split); credit records goods received on credit. */
  mode: SaleMode
  customerId: number | null
  walkin: WalkinInput | null
  lines: SaleLineInput[]
  additionalCharges: number
  cashCollected: number
  upiCollected: number
  remarks: string | null
}

export interface TransferLegInput {
  productId: number
  bagSizeKg: number | null
  qty: number
}

export interface CreateStockTransferInput {
  source: TransferLegInput[]
  target: TransferLegInput[]
  remarks: string | null
}

/**
 * Receipt, Payment (customer-bound) and Expense, Income (labelled) share a shape.
 * Money is split across cash and UPI (the cashier types UPI; cash is the remainder).
 * Receipt/Payment may carry a settlement discount; Expense/Income never do.
 */
export interface CreateMoneyTxnInput {
  customerId: number | null
  label: string | null
  /** Gross amount before any discount. */
  amount: number
  /** Settlement discount as a percent of `amount` (0 for Expense/Income). */
  discountPercent: number
  /** Cash portion of the net (amount − discount). */
  cashCollected: number
  /** UPI portion of the net (amount − discount). */
  upiCollected: number
  remarks: string | null
}

/** Net money actually moved for a money transaction: amount less its discount. */
export function moneyNetAmount(amount: number, discountPercent: number): number {
  return amount * (1 - discountPercent / 100)
}

// ── ID + date helpers (ADR-0009) ─────────────────────────────────────────────

/** 'YYYY-MM-DD' -> 'DDMMYYYY' for the internal id suffix. */
export function dateToDDMMYYYY(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}${m}${y}`
}

/** Build the globally-unique internal id `TT-NNNN-DDMMYYYY`. Never shown to the cashier. */
export function formatTxnId(type: TxnType, seq: number, startDate: string): string {
  const nnnn = String(seq).padStart(4, '0')
  return `${type}-${nnnn}-${dateToDDMMYYYY(startDate)}`
}

// ── Stock delta + Inventory projection (ADR-0005) ────────────────────────────

/**
 * Signed change in stock for one line, expressed in the Product's Default Bag Size units.
 * Packaged stock is whole units; Bulk stock is fractional when a non-default Bag Type moves
 * (a 25kg bag against a 50kg default contributes 0.5).
 */
export function lineStockDelta(args: {
  productType: ProductType
  qty: number
  bagSizeKg: number | null
  defaultBagSizeKg: number | null
  direction: 1 | -1
}): number {
  const { productType, qty, bagSizeKg, defaultBagSizeKg, direction } = args
  if (productType === 'packaged') return direction * qty
  if (!bagSizeKg || !defaultBagSizeKg) return direction * qty
  return direction * qty * (bagSizeKg / defaultBagSizeKg)
}

export interface ProjectionProduct {
  id: number
  name: string
  productGroupName: string
  type: ProductType
  defaultBagSizeKg: number | null
}

export interface ProjectionMovement {
  productId: number
  type: TxnType
  stockDelta: number
}

export interface InventoryRow {
  productId: number
  productName: string
  productGroupName: string
  productType: ProductType
  defaultBagSizeKg: number | null
  opening: number
  purchased: number
  sold: number
  transferIn: number
  transferOut: number
  closing: number
  /** True when the live projection has driven stock below zero (ADR-0005). */
  negative: boolean
}

/**
 * The Inventory projection: Opening Stock + replay of live (non-voided) movements.
 * Callers must pre-filter movements to voided = 0; this function trusts its inputs.
 */
export function projectInventory(
  products: ProjectionProduct[],
  opening: Map<number, number>,
  movements: ProjectionMovement[]
): InventoryRow[] {
  const rows = new Map<number, InventoryRow>()
  for (const p of products) {
    rows.set(p.id, {
      productId: p.id,
      productName: p.name,
      productGroupName: p.productGroupName,
      productType: p.type,
      defaultBagSizeKg: p.defaultBagSizeKg,
      opening: opening.get(p.id) ?? 0,
      purchased: 0,
      sold: 0,
      transferIn: 0,
      transferOut: 0,
      closing: 0,
      negative: false
    })
  }

  for (const m of movements) {
    const row = rows.get(m.productId)
    if (!row) continue
    if (m.type === 'PU') row.purchased += m.stockDelta
    else if (m.type === 'SA') row.sold += -m.stockDelta
    else if (m.type === 'ST') {
      if (m.stockDelta >= 0) row.transferIn += m.stockDelta
      else row.transferOut += -m.stockDelta
    }
  }

  for (const row of rows.values()) {
    row.closing = row.opening + row.purchased - row.sold + row.transferIn - row.transferOut
    row.negative = row.closing < 0
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.productGroupName.localeCompare(b.productGroupName) ||
      a.productName.localeCompare(b.productName)
  )
}

// ── Drawer summary (End of Day) ──────────────────────────────────────────────

export interface DrawerSummary {
  cashIn: number
  upiIn: number
  cashOut: number
  upiOut: number
  cashNet: number
  upiNet: number
  creditIssued: number
  creditReceived: number
}

/** Aggregate the day's drawer from live (non-voided) transactions. */
export function summariseDrawer(txns: Txn[]): DrawerSummary {
  const s: DrawerSummary = {
    cashIn: 0,
    upiIn: 0,
    cashOut: 0,
    upiOut: 0,
    cashNet: 0,
    upiNet: 0,
    creditIssued: 0,
    creditReceived: 0
  }
  for (const t of txns) {
    if (t.voided) continue
    s.cashIn += t.cashIn
    s.upiIn += t.upiIn
    s.cashOut += t.cashOut
    s.upiOut += t.upiOut
    // creditIssued tracks Credit Vouchers we hand out — Sales only, not Credit Purchases.
    if (t.type === 'SA') s.creditIssued += t.creditAmount
    if (t.type === 'RE') s.creditReceived += t.cashIn + t.upiIn
  }
  s.cashNet = s.cashIn - s.cashOut
  s.upiNet = s.upiIn - s.upiOut
  return s
}
