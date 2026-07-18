/**
 * Domain types and the shared projection library for Vajra's transactional core.
 *
 * Uses the glossary from CONTEXT.md exactly. The functions here are pure — they are
 * the single source of truth for stock deltas and the Inventory projection (ADR-0005),
 * shared by the repository (write time), the live UI, and the End of Day Report.
 *
 * Money fields are integer **paise**. Bag sizes and stock are integer **grams**.
 * Loose quantity is entered as kg and converted to grams for stock.
 */

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
  side: TxnLineSide
  /** True when this is a Loose line (no Bag Type; qty is kg; perKgRate set). */
  isLoose: boolean
  /** Bag Type in grams; null for Loose. */
  bagSizeG: number | null
  /** Paise per quintal; null for Loose. */
  quintalRate: number | null
  /** Paise per kg; null for bag lines. */
  perKgRate: number | null
  /**
   * Bag count for bag lines; kilograms for Loose.
   */
  qty: number
  /**
   * Stock change in grams. Sign is the ledger direction (negative on Sale).
   */
  stockDelta: number
  /** Line total in paise. */
  lineTotal: number
}

export interface Txn {
  id: string
  type: TxnType
  /** Per-day base sequence for (type, mode) — shared across edit revisions (ADR-0009). */
  seq: number
  /**
   * Edit revision: 0 = first finish of this sequence; 1, 2, … = Edit successors (`.1`, `.2` in the ID).
   */
  rev: number
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
  /**
   * Whether the cashier opted into Loading Charge on this Sale.
   * True even when the promised amount is ₹0 (free band). Always false for non-Sales.
   */
  loadingApplied: boolean
  total: number
  creditAmount: number
  /**
   * On Sale (SA): cart-level **Discount** in paise — simple rupee reduction of the Sale total
   * (not Settlement Discount; not face/realized). On Receipt/Payment (RE/PA): Settlement
   * Discount write-off in paise; face is cash + UPI + discount and `total` stays realized.
   * Always 0 for Purchase, Expense, Income, Stock Transfer.
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
  /** Loose: no Bag Type; qty is kg; rate is perKgRate. */
  isLoose: boolean
  bagSizeG: number | null
  /** Paise per quintal. */
  quintalRate: number | null
  /** Paise per kg (Loose only). */
  perKgRate: number | null
  qty: number
}

export interface WalkinInput {
  name: string
  place: string
  phone: string | null
}

/**
 * Stored when walk-in name or place is left blank (CONTEXT.md Walk-in Customer).
 * Spelling matches the megathread / cashier-facing default: "Walk in" (space, not hyphen).
 */
export const WALKIN_PLACEHOLDER = 'Walk in'

/** Fill blank name/place with {@link WALKIN_PLACEHOLDER}; trim phone to null when empty. */
export function normalizeWalkin(walkin: WalkinInput): WalkinInput {
  const phone = walkin.phone?.trim() || null
  return {
    name: walkin.name.trim() || WALKIN_PLACEHOLDER,
    place: walkin.place.trim() || WALKIN_PLACEHOLDER,
    phone
  }
}

export interface CreateSaleInput {
  mode: SaleMode
  customerId: number | null
  walkin: WalkinInput | null
  lines: SaleLineInput[]
  additionalCharges: number
  /**
   * Promised Loading Charge in paise (integer ≥ 0). Stored as-is on the finished
   * Sale — never recomputed from settings at write time.
   */
  loadingCharges: number
  /**
   * Cashier opted into Loading Charge. True even when loadingCharges is 0 (free band).
   * Persisted so Edit rehydrates the toggle from the flag, not from the amount.
   */
  loadingApplied: boolean
  /**
   * Sale **Discount** in paise — optional rupee amount that reduces the Sale total
   * (Cash and Credit). Not Settlement Discount; not a percent.
   */
  discountAmount: number
  cashCollected: number
  upiCollected: number
  /**
   * Pre-reserved base sequence from Credit Voucher print (same ID as the invoice will use).
   * Null allocates a fresh sequence at write time. Ignored for Cash Sales.
   */
  reservedSeq: number | null
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

/** 'YYYY-MM-DD' -> 'DDMMYYYY' for the id suffix. */
export function dateToDDMMYYYY(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}${m}${y}`
}

/** Cash/Credit letter in the transaction ID (SA and PU only). */
export function saleModeCode(mode: SaleMode): 'C' | 'R' {
  return mode === 'cash' ? 'C' : 'R'
}

export interface FormatTxnIdArgs {
  type: TxnType
  /** Required for SA and PU; omitted for other types. */
  mode?: SaleMode | null
  seq: number
  /** 0 or omit = first finish; 1, 2, … = Edit successors. */
  rev?: number
  /** Business Day start date YYYY-MM-DD. */
  startDate: string
}

/**
 * Build the transaction ID: `TT[-MODE]-SEQ[.REV]-DDMMYYYY`.
 * One identifier for storage, UI, invoice, voucher, and successor pointers (ADR-0009).
 */
export function formatTxnId(args: FormatTxnIdArgs): string {
  const { type, mode, seq, rev = 0, startDate } = args
  const modePart = (type === 'SA' || type === 'PU') && mode != null ? `-${saleModeCode(mode)}` : ''
  const seqPart = rev > 0 ? `${seq}.${rev}` : String(seq)
  return `${type}${modePart}-${seqPart}-${dateToDDMMYYYY(startDate)}`
}

/**
 * Compact day-local serial for lists: `C-20`, `C-20.1`, `R-3`, or `4` / `4.1` for types without mode.
 * Derived only from stored fields — never a second source of truth.
 */
export function displayTxnSerial(
  t: Pick<Txn, 'type' | 'seq' | 'rev' | 'saleMode'> | FormatTxnIdArgs
): string {
  const seq = t.seq
  const rev = 'rev' in t && t.rev != null ? t.rev : 0
  const seqPart = rev > 0 ? `${seq}.${rev}` : String(seq)
  const mode = 'saleMode' in t ? t.saleMode : (t.mode ?? null)
  const type = t.type
  if ((type === 'SA' || type === 'PU') && mode != null) {
    return `${saleModeCode(mode)}-${seqPart}`
  }
  return seqPart
}

// ── Stock delta + Inventory projection (ADR-0005) ────────────────────────────

/**
 * Signed change in stock for one goods line (grams).
 * - Bag line: qty bags × bag size g.
 * - Loose: qty kg × 1000 g.
 */
export function lineStockDelta(args: {
  isLoose: boolean
  qty: number
  bagSizeG: number | null
  direction: 1 | -1
}): number {
  const { isLoose, qty, bagSizeG, direction } = args
  if (isLoose) return looseStockDeltaG(qty, direction)
  if (!bagSizeG) return direction * roundHalfAway(qty)
  return bulkStockDeltaG(qty, bagSizeG, direction)
}

export interface ProjectionProduct {
  id: number
  name: string
  productGroupName: string
  defaultBagSizeG: number
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
  defaultBagSizeG: number
  /** Grams. */
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
 * Quantities are grams.
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
  creditSales: number
  /** Goods bought on credit — sum of Purchase `creditAmount` (we owe supplier), paise. */
  creditPurchases: number
}

/**
 * Aggregate the day's drawer from live (non-voided) transactions.
 * Cash/UPI come from the generic drawer columns on every type (including Receipts
 * and Payments). Credit Sales/Credit Purchases are face totals on Sales/Purchases
 * only — Receipt cash-in and Payment cash-out must never inflate these fields.
 */
export function summariseDrawer(txns: Txn[]): DrawerSummary {
  const s: DrawerSummary = {
    cashIn: 0,
    upiIn: 0,
    cashOut: 0,
    upiOut: 0,
    cashNet: 0,
    upiNet: 0,
    creditSales: 0,
    creditPurchases: 0
  }
  for (const t of txns) {
    if (t.voided) continue
    s.cashIn += t.cashIn
    s.upiIn += t.upiIn
    s.cashOut += t.cashOut
    s.upiOut += t.upiOut
    if (t.type === 'SA') s.creditSales += t.creditAmount
    if (t.type === 'PU') s.creditPurchases += t.creditAmount
  }
  s.cashNet = s.cashIn - s.cashOut
  s.upiNet = s.upiIn - s.upiOut
  return s
}
