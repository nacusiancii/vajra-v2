import type { Database } from 'better-sqlite3'
import {
  projectInventory,
  type BusinessDay,
  type InventoryRow,
  type ProjectionMovement,
  type ProjectionProduct,
  type TxnType
} from '../../domain/transaction'

interface DayRow {
  id: number
  start_date: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at: string | null
}

function rowToDay(row: DayRow): BusinessDay {
  return {
    id: row.id,
    startDate: row.start_date,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at
  }
}

/**
 * Owns the open Business Day, its Opening Stock, the live Inventory projection (ADR-0005),
 * and Rollover (CONTEXT.md). Exactly one Business Day is open at a time (ADR-0001).
 */
export class BusinessDayRepo {
  constructor(private db: Database) {}

  current(): BusinessDay {
    const row = this.db
      .prepare(`SELECT * FROM business_day WHERE status = 'open' ORDER BY id DESC LIMIT 1`)
      .get() as DayRow | undefined
    if (!row) {
      // Defensive: getDb() bootstraps one, but never hand back nothing.
      this.db.prepare(`INSERT INTO business_day (start_date) VALUES (date('now'))`).run()
      return this.current()
    }
    return rowToDay(row)
  }

  /** The live Inventory projection for the open Business Day. */
  inventory(): InventoryRow[] {
    const day = this.current()

    const products = this.db
      .prepare(
        `SELECT p.id, p.name, p.type, p.default_bag_size_kg AS dbs, pg.name AS group_name
         FROM product p JOIN product_group pg ON pg.id = p.product_group_id`
      )
      .all() as Array<{
      id: number
      name: string
      type: 'packaged' | 'bulk'
      dbs: number | null
      group_name: string
    }>

    const projProducts: ProjectionProduct[] = products.map((p) => ({
      id: p.id,
      name: p.name,
      productGroupName: p.group_name,
      type: p.type,
      defaultBagSizeKg: p.dbs
    }))

    const opening = new Map<number, number>()
    for (const r of this.db
      .prepare(`SELECT product_id, qty FROM opening_stock WHERE business_day_id = ?`)
      .all(day.id) as Array<{ product_id: number; qty: number }>) {
      opening.set(r.product_id, r.qty)
    }

    const movements = this.db
      .prepare(
        `SELECT l.product_id, t.type, l.stock_delta
         FROM txn_line l JOIN txn t ON t.id = l.txn_id
         WHERE t.business_day_id = ? AND t.voided = 0`
      )
      .all(day.id) as Array<{ product_id: number; type: TxnType; stock_delta: number }>

    const projMovements: ProjectionMovement[] = movements.map((m) => ({
      productId: m.product_id,
      type: m.type,
      stockDelta: m.stock_delta
    }))

    return projectInventory(projProducts, opening, projMovements)
  }

  /**
   * Approve the Rollover: freeze the live projection as the next day's Opening Stock,
   * wipe the closing day's transactional data, close it, and open the next Business Day.
   * Returns the newly opened day.
   */
  approveRollover(): BusinessDay {
    const closing = this.inventory()
    const day = this.current()

    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM txn_line WHERE txn_id IN (SELECT id FROM txn WHERE business_day_id = ?)`).run(
        day.id
      )
      this.db.prepare(`DELETE FROM txn WHERE business_day_id = ?`).run(day.id)
      this.db
        .prepare(`UPDATE business_day SET status = 'closed', closed_at = datetime('now') WHERE id = ?`)
        .run(day.id)

      const next = this.db
        .prepare(`INSERT INTO business_day (start_date) VALUES (date('now'))`)
        .run()
      const nextId = Number(next.lastInsertRowid)

      const insertOpening = this.db.prepare(
        `INSERT INTO opening_stock (business_day_id, product_id, qty) VALUES (?, ?, ?)`
      )
      for (const row of closing) {
        // Carry every product forward; clamp projected-negative to 0 so a new day never
        // opens already in deficit (ADR-0005 surfaces the deficit; it does not persist it).
        insertOpening.run(nextId, row.productId, Math.max(0, row.closing))
      }
      return nextId
    })

    tx()
    return this.current()
  }
}
