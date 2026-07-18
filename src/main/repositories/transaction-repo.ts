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
  type SaleMode,
  type Txn,
  type TxnLine,
  type TxnType
} from '../../domain/transaction'
import {
  grandTotal,
  lineTotal,
  MoneyTxnSchema,
  PurchaseWriteSchema,
  SaleWriteSchema,
  validatePurchase,
  validateSale,
  type LineProductLookup
} from '../../domain/transaction-rules'

interface TxnRow {
  id: string
  type: TxnType
  seq: number
  rev: number
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
  loading_applied: number
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

  createSale(input: CreateSaleInput, inherit?: { seq: number; rev: number }): Txn {
    const parsed = SaleWriteSchema.parse(input)
    const products = this.productMeta()
    const productLookup = this.toLineProductLookup(products)
    const reason = validateSale(parsed.lines, productLookup, {
      mode: parsed.mode,
      hasCustomer: parsed.customerId != null,
      customerHasPhone:
        parsed.customerId != null ? this.customerHasPhone(parsed.customerId) : false,
      isWalkin: parsed.walkin != null
    })
    if (reason) throw new Error(reason)

    // Loading Charge on a finished Sale is the amount promised to the customer and
    // printed on the invoice. It is NEVER recomputed from settings here — settings
    // breakpoints only suggest amounts for new carts and Edit successors. This write
    // validates shape only (integer paise ≥ 0 via SaleWriteSchema).
    const loadingCharges = parsed.loadingCharges
    const loadingApplied = parsed.loadingApplied
    const discountAmount = parsed.discountAmount

    const resolved = parsed.lines.map((l) => this.resolveGoodsLine(l, products, -1))
    const lineTotals = resolved.map((r) => r.lineTotal)
    const preDiscount = grandTotal(lineTotals, loadingCharges, parsed.additionalCharges, 0)
    if (discountAmount > preDiscount) {
      throw new Error('Discount cannot exceed the Sale total')
    }
    // Sale total is goods + Loading + Additional − Discount (CONTEXT.md). Credit Sales
    // Total and cash due both use this reduced amount — no separate face/realized split.
    const total = grandTotal(lineTotals, loadingCharges, parsed.additionalCharges, discountAmount)
    const drawer: DrawerColumns =
      parsed.mode === 'cash'
        ? { cashIn: parsed.cashCollected, upiIn: parsed.upiCollected, cashOut: 0, upiOut: 0 }
        : ZERO_DRAWER

    return this.insert(
      'SA',
      resolved,
      {
        saleMode: parsed.mode,
        customerId: parsed.customerId,
        walkin: parsed.walkin,
        additionalCharges: parsed.additionalCharges,
        loadingCharges,
        loadingApplied,
        total,
        creditAmount: parsed.mode === 'credit' ? total : 0,
        discountAmount,
        drawer,
        // Credit voucher print pre-reserves the same sequence the invoice will use (ADR-0009).
        reservedSeq: parsed.mode === 'credit' ? parsed.reservedSeq : null,
        remarks: parsed.remarks
      },
      inherit
    )
  }

  /**
   * Reserve the next Credit Sale sequence for a voucher print before finish.
   * Invoice and voucher share this sequence as one transaction ID (ADR-0009).
   * Reprints at the same cart should reuse the returned seq (caller responsibility).
   */
  reserveCreditSaleSeq(): number {
    const dayId = this.currentDayId()
    const reserve = this.db.transaction(() => {
      const seq = this.nextSeq('SA', 'credit')
      this.db
        .prepare(
          `UPDATE business_day SET credit_sale_reserved = MAX(credit_sale_reserved, ?) WHERE id = ?`
        )
        .run(seq, dayId)
      return seq
    })
    return reserve()
  }

  createPurchase(input: CreatePurchaseInput, inherit?: { seq: number; rev: number }): Txn {
    const parsed = PurchaseWriteSchema.parse(input)
    const products = this.productMeta()
    const productLookup = this.toLineProductLookup(products)
    const reason = validatePurchase(parsed.lines, productLookup)
    if (reason) throw new Error(reason)

    const resolved = parsed.lines.map((l) => this.resolveGoodsLine(l, products, 1))
    const total = grandTotal(
      resolved.map((r) => r.lineTotal),
      0,
      parsed.additionalCharges
    )
    const drawer: DrawerColumns =
      parsed.mode === 'cash'
        ? { cashIn: 0, upiIn: 0, cashOut: parsed.cashCollected, upiOut: parsed.upiCollected }
        : ZERO_DRAWER
    return this.insert(
      'PU',
      resolved,
      {
        saleMode: parsed.mode,
        customerId: parsed.customerId,
        walkin: parsed.walkin,
        additionalCharges: parsed.additionalCharges,
        total,
        creditAmount: parsed.mode === 'credit' ? total : 0,
        drawer,
        remarks: parsed.remarks
      },
      inherit
    )
  }

  createStockTransfer(
    input: CreateStockTransferInput,
    inherit?: { seq: number; rev: number }
  ): Txn {
    const products = this.productMeta()
    const resolved: ResolvedLine[] = [
      ...input.source.map((leg) => this.resolveTransferLeg(leg, products, 'source', -1)),
      ...input.target.map((leg) => this.resolveTransferLeg(leg, products, 'target', 1))
    ]
    return this.insert(
      'ST',
      resolved,
      {
        total: 0,
        drawer: ZERO_DRAWER,
        remarks: input.remarks
      },
      inherit
    )
  }

  createMoneyTxn(
    type: Extract<TxnType, 'RE' | 'PA' | 'EX' | 'IN'>,
    input: CreateMoneyTxnInput,
    inherit?: { seq: number; rev: number }
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
    return this.insert(
      type,
      [],
      {
        customerId: parsed.customerId,
        label: parsed.label,
        total: moneyRealized(parsed.cashCollected, parsed.upiCollected),
        discountAmount: type === 'RE' || type === 'PA' ? parsed.discountAmount : 0,
        drawer,
        remarks: parsed.remarks
      },
      inherit
    )
  }

  // ── Edit = void + successor (ADR-0007) ─────────────────────────────────────

  editSale(id: string, input: CreateSaleInput): Txn {
    return this.replace(id, 'SA', (inherit) => this.createSaleWithInherit(input, inherit))
  }

  editPurchase(id: string, input: CreatePurchaseInput): Txn {
    return this.replace(id, 'PU', (inherit) => this.createPurchaseWithInherit(input, inherit))
  }

  editStockTransfer(id: string, input: CreateStockTransferInput): Txn {
    return this.replace(id, 'ST', (inherit) => this.createStockTransferWithInherit(input, inherit))
  }

  editMoneyTxn(
    id: string,
    type: Extract<TxnType, 'RE' | 'PA' | 'EX' | 'IN'>,
    input: CreateMoneyTxnInput
  ): Txn {
    return this.replace(id, type, (inherit) => this.createMoneyTxnWithInherit(type, input, inherit))
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** Base sequence + next revision carried from a voided original into its successor. */
  private inheritFrom(original: Txn): { seq: number; rev: number } {
    return { seq: original.seq, rev: original.rev + 1 }
  }

  private replace(
    id: string,
    type: TxnType,
    create: (inherit: { seq: number; rev: number }) => Txn
  ): Txn {
    const original = this.getById(id)
    if (!original) throw new Error(`Transaction ${id} not found`)
    if (original.type !== type) throw new Error(`Transaction ${id} is not a ${type}`)
    if (original.voided) throw new Error('Already-voided transactions cannot be edited (ADR-0007)')

    const tx = this.db.transaction(() => {
      const successor = create(this.inheritFrom(original))
      this.db
        .prepare(`UPDATE txn SET voided = 1, successor_id = ? WHERE id = ?`)
        .run(successor.id, id)
      return successor
    })
    return tx()
  }

  /** Edit path: createSale while forcing seq/rev from the voided original (ADR-0009). */
  private createSaleWithInherit(
    input: CreateSaleInput,
    inherit: { seq: number; rev: number }
  ): Txn {
    // reservedSeq is irrelevant on Edit — chain keeps the original base sequence.
    return this.createSale({ ...input, reservedSeq: null }, inherit)
  }

  private createPurchaseWithInherit(
    input: CreatePurchaseInput,
    inherit: { seq: number; rev: number }
  ): Txn {
    return this.createPurchase(input, inherit)
  }

  private createStockTransferWithInherit(
    input: CreateStockTransferInput,
    inherit: { seq: number; rev: number }
  ): Txn {
    return this.createStockTransfer(input, inherit)
  }

  private createMoneyTxnWithInherit(
    type: Extract<TxnType, 'RE' | 'PA' | 'EX' | 'IN'>,
    input: CreateMoneyTxnInput,
    inherit: { seq: number; rev: number }
  ): Txn {
    return this.createMoneyTxn(type, input, inherit)
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
      /** Sale opt-in flag; always 0 for non-Sales. */
      loadingApplied?: boolean
      total: number
      creditAmount?: number
      discountAmount?: number
      drawer: DrawerColumns
      /** Pre-reserved seq (Credit Sale voucher print); ignored when inherit is set. */
      reservedSeq?: number | null
      remarks: string | null
    },
    inherit?: { seq: number; rev: number }
  ): Txn {
    const day = this.currentDay()
    const tx = this.db.transaction(() => {
      const saleMode = fields.saleMode ?? null
      const seq =
        inherit?.seq ??
        (fields.reservedSeq != null && saleMode === 'credit' && type === 'SA'
          ? fields.reservedSeq
          : this.nextSeq(type, saleMode))
      const rev = inherit?.rev ?? 0
      const id = formatTxnId({
        type,
        mode: saleMode,
        seq,
        rev,
        startDate: day.startDate
      })
      this.db
        .prepare(
          `INSERT INTO txn (
             id, business_day_id, type, seq, rev, sale_mode, customer_id,
             walkin_name, walkin_place, walkin_phone, label,
             cash_in, upi_in, cash_out, upi_out,
             additional_charges, loading_charges, loading_applied,
             total, credit_amount, discount_amount, remarks
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          day.id,
          type,
          seq,
          rev,
          saleMode,
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
          fields.loadingApplied ? 1 : 0,
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

  private toLineProductLookup(products: Map<number, ProductMeta>): Map<number, LineProductLookup> {
    const out = new Map<number, LineProductLookup>()
    for (const [id, p] of products) {
      out.set(id, { defaultBagSizeG: p.defaultBagSizeG })
    }
    return out
  }

  private customerHasPhone(customerId: number): boolean {
    const row = this.db.prepare(`SELECT phone FROM customer WHERE id = ?`).get(customerId) as
      | { phone: string | null }
      | undefined
    return !!(row?.phone && row.phone.trim() !== '')
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

  /**
   * Next base sequence for this type (and Cash/Credit mode for SA/PU).
   * Edit revisions do not consume a new sequence. Credit Sale reservations bump
   * `credit_sale_reserved` so a printed voucher holds a gap until finish (or abandon).
   */
  private nextSeq(type: TxnType, saleMode: SaleMode | null): number {
    const dayId = this.currentDayId()
    let fromTxn: number
    if ((type === 'SA' || type === 'PU') && saleMode != null) {
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(seq), 0) AS m FROM txn
           WHERE business_day_id = ? AND type = ? AND sale_mode = ?`
        )
        .get(dayId, type, saleMode) as { m: number }
      fromTxn = row.m
    } else {
      const row = this.db
        .prepare(
          `SELECT COALESCE(MAX(seq), 0) AS m FROM txn WHERE business_day_id = ? AND type = ?`
        )
        .get(dayId, type) as { m: number }
      fromTxn = row.m
    }

    let floor = fromTxn
    if (type === 'SA' && saleMode === 'credit') {
      const day = this.db
        .prepare(`SELECT credit_sale_reserved AS n FROM business_day WHERE id = ?`)
        .get(dayId) as { n: number }
      floor = Math.max(floor, day.n)
    }
    return floor + 1
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
      rev: row.rev ?? 0,
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
      loadingApplied: row.loading_applied === 1,
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
