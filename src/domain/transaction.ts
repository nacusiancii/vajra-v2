/**
 * Domain types and the shared projection library for Vajra's transactional core.
 *
 * Uses the glossary from CONTEXT.md exactly. The functions here are pure — they are
 * the single source of truth for stock deltas and the Inventory projection (ADR-0005),
 * shared by the repository (write time), the live UI, and the End of Day Report.
 *
 * Money fields are integer **paise**. Bag sizes and bulk stock are integer **grams**.
 */

import type { ProductType } from './types'
import { bulkStockDeltaG, looseStockDeltaG, roundHalfAway } from './units'

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
  /**
   * true = loose bulk (qty in kg, unitRate is paise/kg, bagSizeG null).
   * Inferred at read time when bulk and bagSizeG is null.
   */
  isLoose: boolean
  /** Default Bag Size in grams for bagged bulk; null for Packaged and loose bulk. */
  bagSizeG: number | null
  /** Paise per quintal (bagged bulk). */
  quintalRate: number | null
  /** Paise per unit (packaged) or paise per kg (loose bulk). */
  unitRate: number | null
  /**
   * Bagged bulk: bag count. Loose bulk: kilograms. Packaged: unit count.
   */
  qty: number
  /**
   * Stock change: grams for Bulk, units for Packaged.
   * Sign is the ledger direction (negative on Sale).
   */
  stockDelta: number
  /** Line total in paise. */
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
  /** Drawer columns — paise. */
  cashIn: number
  upiIn: number
  cashOut: number
  upiOut: number
  additionalCharges: number
  loadingCharges: number
  total: number
  creditAmount: number
  /**
   * Settlement write-off in paise (RE/PA). Always 0 for other types.
   * Face amount is derived: cash + UPI + discount; `total` stays realized (cash + UPI).
   */
  discountAmount: number
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
  /**
   * Loose bulk: qty is kg (1–50), unitRate is paise/kg, bagSizeG null, quintalRate null.
   * Bagged bulk: qty is bags, bagSizeG = Default Bag Size, quintalRate set.
   */
  isLoose: boolean
  bagSizeG: number | null
  /** Paise per quintal (bagged bulk). */
  quintalRate: number | null
  /** Paise per unit (packaged) or paise per kg (loose bulk). */
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
  /** Credit Voucher number minted at print time (null for Cash Sales). */
  voucherSeq: number | null
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
  bagSizeG: number | null
  qty: number
}

export interface CreateStockTransferInput {
  source: TransferLegInput[]
  target: TransferLegInput[]
  remarks: string | null
}

/**
 * Receipt, Payment (customer-bound) and Expense, Income (labelled) share a shape.
 * All money fields are integer paise.
 */
export interface CreateMoneyTxnInput {
  customerId: number | null
  label: string | null
  cashCollected: number
  upiCollected: number
  /** Settlement write-off in paise. RE/PA only; always 0 for Expense/Income. */
  discountAmount: number
  remarks: string | null
}

/** Realized money moved through the drawer: cash + UPI (excludes discount write-off). */
export function moneyRealized(cash: number, upi: number): number {
  return cash + upi
}

/** Face amount: realized + discount write-off. */
export function moneyFace(cash: number, upi: number, discountAmount: number): number {
  return cash + upi + discountAmount
}

/** Discount as a percent of face (0 when face is 0). Derived only when a view needs it. */
export function moneyDiscountPercent(cash: number, upi: number, discountAmount: number): number {
  const face = moneyFace(cash, upi, discountAmount)
  return face > 0 ? (discountAmount / face) * 100 : 0
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
 * Signed change in stock for one line.
 * - Packaged: whole units (qty rounded to nearest integer count when fractional).
 * - Bagged bulk: grams moved (qty bags × bag size g).
 * - Loose bulk: grams moved (qty kg → grams).
 */
export function lineStockDelta(args: {
  productType: ProductType
  qty: number
  bagSizeG: number | null
  defaultBagSizeG: number | null
  direction: 1 | -1
  isLoose?: boolean
}): number {
  const { productType, qty, bagSizeG, direction, isLoose } = args
  if (productType === 'packaged') return direction * roundHalfAway(qty)
  if (isLoose) return looseStockDeltaG(qty, direction)
  if (!bagSizeG) return 0
  return bulkStockDeltaG(qty, bagSizeG, direction)
}

export interface ProjectionProduct {
  id: number
  name: string
  productGroupName: string
  type: ProductType
  defaultBagSizeG: number | null
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
  defaultBagSizeG: number | null
  /** Bulk: grams. Packaged: units. */
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
 * Quantities are grams (Bulk) or units (Packaged).
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
      defaultBagSizeG: p.defaultBagSizeG,
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
  /** Goods sold on credit — sum of Sale `creditAmount` (customer owes us), paise. */
  creditIssued: number
  /** Goods bought on credit — sum of Purchase `creditAmount` (we owe supplier), paise. */
  creditReceived: number
}

/**
 * Aggregate the day's drawer from live (non-voided) transactions.
 * Cash/UPI come from the generic drawer columns on every type (including Receipts
 * and Payments). Credit issued/received are face totals on Sales/Purchases only —
 * Receipt money-in must not also inflate creditReceived.
 */
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
    if (t.type === 'SA') s.creditIssued += t.creditAmount
    if (t.type === 'PU') s.creditReceived += t.creditAmount
  }
  s.cashNet = s.cashIn - s.cashOut
  s.upiNet = s.upiIn - s.upiOut
  return s
}
