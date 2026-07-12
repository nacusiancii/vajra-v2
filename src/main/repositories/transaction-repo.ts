import type { Database } from 'better-sqlite3'
import {
  formatTxnId,
  lineStockDelta,
  moneyRealized,
  type CreateMoneyTxnInput,
  type CreatePurchaseInput,
  type CreateSaleInput,
  type CreateStockTransferInput,
  type SaleLineInput,
  type Txn,
  type TxnLine,
  type TxnType
} from '../../domain/transaction'
import { grandTotal, lineTotal, MoneyTxnSchema } from '../../domain/transaction-rules'

interface TxnRow {
  id: string
  type: TxnType
  seq: number
  voucher_seq: number | null
  sale_mode: 'cash' | 'credit' | null
  customer_id: number | null
  customer_name: string | null
  walkin_name: string | null
  walkin_place: string | null
  walkin_phone: string | null
  label: string | null
  cash_in: number
  upi_in: number
  cash_out: number
  upi_out: number
  additional_charges: number
  loading_charges: number
  total: number
  credit_amount: number
  discount_amount: number
  remarks: string | null
  voided: number
  successor_id: string | null
  created_at: string
}

interface LineRow {
  id: number
  product_id: number
  product_name: string
  side: 'single' | 'source' | 'target'
  is_loose: number
  bag_size_g: number | null
  quintal_rate: number | null
  per_kg_rate: number | null
  qty: number
  stock_delta: number
  line_total: number
}

interface ProductMeta {
  id: number
  defaultBagSizeG: number
}

/** A computed line ready to insert: stock_delta and line_total already resolved. */
interface ResolvedLine {
  side: 'single' | 'source' | 'target'
  productId: number
  isLoose: boolean
  bagSizeG: number | null
  quintalRate: number | null
  perKgRate: number | null
  qty: number
  stockDelta: number
  lineTotal: number
}

interface DrawerColumns {
  cashIn: number
  upiIn: number
  cashOut: number
  upiOut: number
}

const ZERO_DRAWER: DrawerColumns = { cashIn: 0, upiIn: 0, cashOut: 0, upiOut: 0 }

/**
 * Owns the transactional ledger: creating each transaction type, listing the open day's
 * transactions, and Edit-as-void-plus-successor (ADR-0007). Stock deltas are computed and
 * stored at write time so the Inventory projection stays a pure SUM (ADR-0005).
 * All money is integer paise; stock is integer grams.
 */
export class TransactionRepo {
  constructor(private db: Database) {}

  // ── Reads ──────────────────────────────────────────────────────────────────

  list(): Txn[] {
    const dayId = this.currentDayId()
    const rows = this.db
      .prepare(
        `SELECT t.*, c.name AS customer_name
         FROM txn t LEFT JOIN customer c ON c.id = t.customer_id
         WHERE t.business_day_id = ?
         ORDER BY t.created_at DESC, t.id DESC`
      )
      .all(dayId) as TxnRow[]
    return rows.map((r) => this.hydrate(r))
  }

  getById(id: string): Txn | undefined {
    const row = this.db
      .prepare(
        `SELECT t.*, c.name AS customer_name
         FROM txn t LEFT JOIN customer c ON c.id = t.customer_id
         WHERE t.id = ?`
      )
      .get(id) as TxnRow | undefined
    return row ? this.hydrate(row) : undefined
  }

  // ── Creates ──────────────────────────────────────────────────────────────────

  createSale(input: CreateSaleInput): Txn {
    const products = this.productMeta()
    const resolved = input.lines.map((l) => this.resolveGoodsLine(l, products, -1))
    const total = grandTotal(
      resolved.map((r) => r.lineTotal),
      input.loadingCharges,
      input.additionalCharges
    )
    const drawer: DrawerColumns =
      input.mode === 'cash'
        ? { cashIn: input.cashCollected, upiIn: input.upiCollected, cashOut: 0, upiOut: 0 }
        : ZERO_DRAWER

    return this.insert('SA', resolved, {
      saleMode: input.mode,
      customerId: input.customerId,
      walkin: input.walkin,
      additionalCharges: input.additionalCharges,
      loadingCharges: input.loadingCharges,
      total,
      creditAmount: input.mode === 'credit' ? total : 0,
      drawer,
      voucherSeq: input.mode === 'credit' ? input.voucherSeq : null,
      remarks: input.remarks
    })
  }

  /**
   * Mint the next Credit Voucher number for the open day. Called once per voucher print,
   * so reprints burn the previous number (the day's voucher_counter only ever advances).
   */
  reserveVoucherSeq(): number {
    const dayId = this.currentDayId()
    const reserve = this.db.transaction(() => {
      this.db
        .prepare(`UPDATE business_day SET voucher_counter = voucher_counter + 1 WHERE id = ?`)
        .run(dayId)
      const row = this.db
        .prepare(`SELECT voucher_counter AS n FROM business_day WHERE id = ?`)
        .get(dayId) as { n: number }
      return row.n
    })
    return reserve()
  }

  createPurchase(input: CreatePurchaseInput): Txn {
    const products = this.productMeta()
    const resolved = input.lines.map((l) => this.resolveGoodsLine(l, products, 1))
    const total = grandTotal(
      resolved.map((r) => r.lineTotal),
      0,
      input.additionalCharges
    )
    const drawer: DrawerColumns =
      input.mode === 'cash'
        ? { cashIn: 0, upiIn: 0, cashOut: input.cashCollected, upiOut: input.upiCollected }
        : ZERO_DRAWER
    return this.insert('PU', resolved, {
      saleMode: input.mode,
      customerId: input.customerId,
      walkin: input.walkin,
      additionalCharges: input.additionalCharges,
      total,
      creditAmount: input.mode === 'credit' ? total : 0,
      drawer,
      remarks: input.remarks
    })
  }

  createStockTransfer(input: CreateStockTransferInput): Txn {
    const products = this.productMeta()
    const resolved: ResolvedLine[] = [
      ...input.source.map((leg) => this.resolveTransferLeg(leg, products, 'source', -1)),
      ...input.target.map((leg) => this.resolveTransferLeg(leg, products, 'target', 1))
    ]
    return this.insert('ST', resolved, {
      total: 0,
      drawer: ZERO_DRAWER,
      remarks: input.remarks
    })
  }

  createMoneyTxn(
    type: Extract<TxnType, 'RE' | 'PA' | 'EX' | 'IN'>,
    input: CreateMoneyTxnInput
  ): Txn {
    const parsed = MoneyTxnSchema.parse(input)
    if ((type === 'EX' || type === 'IN') && parsed.discountAmount > 0) {
      throw new Error('Expense and Income cannot carry a discount')
    }
    const moneyIn = type === 'RE' || type === 'IN'
    const drawer: DrawerColumns = {
      cashIn: moneyIn ? parsed.cashCollected : 0,
      upiIn: moneyIn ? parsed.upiCollected : 0,
      cashOut: moneyIn ? 0 : parsed.cashCollected,
      upiOut: moneyIn ? 0 : parsed.upiCollected
    }
    return this.insert(type, [], {
      customerId: parsed.customerId,
      label: parsed.label,
      total: moneyRealized(parsed.cashCollected, parsed.upiCollected),
      discountAmount: type === 'RE' || type === 'PA' ? parsed.discountAmount : 0,
      drawer,
      remarks: parsed.remarks
    })
  }

  // ── Edit = void + successor (ADR-0007) ─────────────────────────────────────

  editSale(id: string, input: CreateSaleInput): Txn {
    return this.replace(id, 'SA', () => this.createSale(input))
  }

  editPurchase(id: string, input: CreatePurchaseInput): Txn {
    return this.replace(id, 'PU', () => this.createPurchase(input))
  }

  editStockTransfer(id: string, input: CreateStockTransferInput): Txn {
    return this.replace(id, 'ST', () => this.createStockTransfer(input))
  }

  editMoneyTxn(
    id: string,
    type: Extract<TxnType, 'RE' | 'PA' | 'EX' | 'IN'>,
    input: CreateMoneyTxnInput
  ): Txn {
    return this.replace(id, type, () => this.createMoneyTxn(type, input))
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private replace(id: string, type: TxnType, create: () => Txn): Txn {
    const original = this.getById(id)
    if (!original) throw new Error(`Transaction ${id} not found`)
    if (original.type !== type) throw new Error(`Transaction ${id} is not a ${type}`)
    if (original.voided) throw new Error('Already-voided transactions cannot be edited (ADR-0007)')

    const tx = this.db.transaction(() => {
      const successor = create()
      this.db
        .prepare(`UPDATE txn SET voided = 1, successor_id = ? WHERE id = ?`)
        .run(successor.id, id)
      return successor
    })
    return tx()
  }

  private insert(
    type: TxnType,
    lines: ResolvedLine[],
    fields: {
      saleMode?: 'cash' | 'credit'
      customerId?: number | null
      walkin?: { name: string; place: string; phone: string | null } | null
      label?: string | null
      additionalCharges?: number
      loadingCharges?: number
      total: number
      creditAmount?: number
      discountAmount?: number
      drawer: DrawerColumns
      voucherSeq?: number | null
      remarks: string | null
    }
  ): Txn {
    const day = this.currentDay()
    const tx = this.db.transaction(() => {
      const seq = this.nextSeq(type)
      const id = formatTxnId(type, seq, day.startDate)
      this.db
        .prepare(
          `INSERT INTO txn (
             id, business_day_id, type, seq, voucher_seq, sale_mode, customer_id,
             walkin_name, walkin_place, walkin_phone, label,
             cash_in, upi_in, cash_out, upi_out,
             additional_charges, loading_charges, total, credit_amount, discount_amount, remarks
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          day.id,
          type,
          seq,
          fields.voucherSeq ?? null,
          fields.saleMode ?? null,
          fields.customerId ?? null,
          fields.walkin?.name ?? null,
          fields.walkin?.place ?? null,
          fields.walkin?.phone ?? null,
          fields.label ?? null,
          fields.drawer.cashIn,
          fields.drawer.upiIn,
          fields.drawer.cashOut,
          fields.drawer.upiOut,
          fields.additionalCharges ?? 0,
          fields.loadingCharges ?? 0,
          fields.total,
          fields.creditAmount ?? 0,
          fields.discountAmount ?? 0,
          fields.remarks
        )

      const insertLine = this.db.prepare(
        `INSERT INTO txn_line (
           txn_id, side, product_id, is_loose, bag_size_g, quintal_rate, per_kg_rate,
           qty, stock_delta, line_total
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      for (const l of lines) {
        insertLine.run(
          id,
          l.side,
          l.productId,
          l.isLoose ? 1 : 0,
          l.bagSizeG,
          l.quintalRate,
          l.perKgRate,
          l.qty,
          l.stockDelta,
          l.lineTotal
        )
      }
      return id
    })

    const id = tx()
    return this.getById(id)!
  }

  private resolveGoodsLine(
    line: SaleLineInput,
    products: Map<number, ProductMeta>,
    direction: 1 | -1
  ): ResolvedLine {
    const product = products.get(line.productId)
    if (!product) throw new Error(`Unknown product ${line.productId}`)
    const isLoose = !!line.isLoose
    const stockDelta = lineStockDelta({
      isLoose,
      qty: line.qty,
      bagSizeG: line.bagSizeG,
      direction
    })
    const total = lineTotal({
      isLoose,
      qty: line.qty,
      bagSizeG: line.bagSizeG,
      quintalRate: line.quintalRate,
      perKgRate: line.perKgRate
    })
    return {
      side: 'single',
      productId: line.productId,
      isLoose,
      bagSizeG: isLoose ? null : line.bagSizeG,
      quintalRate: isLoose ? null : line.quintalRate,
      perKgRate: isLoose ? line.perKgRate : null,
      qty: line.qty,
      stockDelta,
      lineTotal: total
    }
  }

  private resolveTransferLeg(
    leg: { productId: number; bagSizeG: number | null; qty: number },
    products: Map<number, ProductMeta>,
    side: 'source' | 'target',
    direction: 1 | -1
  ): ResolvedLine {
    const product = products.get(leg.productId)
    if (!product) throw new Error(`Unknown product ${leg.productId}`)
    const stockDelta = lineStockDelta({
      isLoose: false,
      qty: leg.qty,
      bagSizeG: leg.bagSizeG,
      direction
    })
    return {
      side,
      productId: leg.productId,
      isLoose: false,
      bagSizeG: leg.bagSizeG,
      quintalRate: null,
      perKgRate: null,
      qty: leg.qty,
      stockDelta,
      lineTotal: 0
    }
  }

  private productMeta(): Map<number, ProductMeta> {
    const rows = this.db
      .prepare(`SELECT id, default_bag_size_g AS dbs FROM product`)
      .all() as Array<{ id: number; dbs: number }>
    return new Map(rows.map((r) => [r.id, { id: r.id, defaultBagSizeG: r.dbs }]))
  }

  private currentDay(): { id: number; startDate: string } {
    const row = this.db
      .prepare(
        `SELECT id, start_date FROM business_day WHERE status = 'open' ORDER BY id DESC LIMIT 1`
      )
      .get() as { id: number; start_date: string } | undefined
    if (!row) throw new Error('No open Business Day')
    return { id: row.id, startDate: row.start_date }
  }

  private currentDayId(): number {
    return this.currentDay().id
  }

  private nextSeq(type: TxnType): number {
    const dayId = this.currentDayId()
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(seq), 0) AS m FROM txn WHERE business_day_id = ? AND type = ?`)
      .get(dayId, type) as { m: number }
    return row.m + 1
  }

  private hydrate(row: TxnRow): Txn {
    const lineRows = this.db
      .prepare(
        `SELECT l.*, p.name AS product_name
         FROM txn_line l JOIN product p ON p.id = l.product_id
         WHERE l.txn_id = ? ORDER BY l.id`
      )
      .all(row.id) as LineRow[]
    const lines: TxnLine[] = lineRows.map((l) => ({
      id: l.id,
      productId: l.product_id,
      productName: l.product_name,
      side: l.side,
      isLoose: l.is_loose === 1,
      bagSizeG: l.bag_size_g,
      quintalRate: l.quintal_rate,
      perKgRate: l.per_kg_rate,
      qty: l.qty,
      stockDelta: l.stock_delta,
      lineTotal: l.line_total
    }))
    return {
      id: row.id,
      type: row.type,
      seq: row.seq,
      voucherSeq: row.voucher_seq,
      saleMode: row.sale_mode,
      customerId: row.customer_id,
      customerName: row.customer_name,
      walkinName: row.walkin_name,
      walkinPlace: row.walkin_place,
      walkinPhone: row.walkin_phone,
      label: row.label,
      cashIn: row.cash_in,
      upiIn: row.upi_in,
      cashOut: row.cash_out,
      upiOut: row.upi_out,
      additionalCharges: row.additional_charges,
      loadingCharges: row.loading_charges,
      total: row.total,
      creditAmount: row.credit_amount,
      discountAmount: row.discount_amount ?? 0,
      remarks: row.remarks,
      voided: row.voided === 1,
      successorId: row.successor_id,
      createdAt: row.created_at,
      lines
    }
  }
}
