import type { Database } from 'better-sqlite3'
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  ProductGroup,
  DeleteCheck
} from '../../domain/types'
import { nullReferenceChecker, type ReferenceChecker } from '../../domain/types'
import type { BagSizeG } from '../../domain/units'

interface ProductRow {
  id: number
  name: string
  product_group_id: number
  product_group_name: string
  default_bag_size_g: number
  name_te: string | null
  remarks: string | null
  inventory_order: number | null
  created_at: string
  updated_at: string
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    productGroupId: row.product_group_id,
    productGroupName: row.product_group_name,
    defaultBagSizeG: row.default_bag_size_g as BagSizeG,
    nameTe: row.name_te,
    remarks: row.remarks,
    inventoryOrder: row.inventory_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class ProductRepo {
  private refChecker: ReferenceChecker

  constructor(
    private db: Database,
    refChecker?: ReferenceChecker
  ) {
    this.refChecker = refChecker ?? nullReferenceChecker
  }

  list(): Product[] {
    const rows = this.db
      .prepare(
        `SELECT p.*, pg.name AS product_group_name
         FROM product p
         JOIN product_group pg ON pg.id = p.product_group_id
         ORDER BY pg.name COLLATE NOCASE,
                  p.inventory_order IS NULL,
                  p.inventory_order,
                  p.name COLLATE NOCASE`
      )
      .all() as ProductRow[]
    return rows.map(rowToProduct)
  }

  getById(id: number): Product | undefined {
    const row = this.db
      .prepare(
        `SELECT p.*, pg.name AS product_group_name
         FROM product p
         JOIN product_group pg ON pg.id = p.product_group_id
         WHERE p.id = ?`
      )
      .get(id) as ProductRow | undefined
    return row ? rowToProduct(row) : undefined
  }

  create(input: CreateProductInput): Product {
    const groupId = this.resolveProductGroup(input.productGroupName)
    const result = this.db
      .prepare(
        `INSERT INTO product (name, product_group_id, default_bag_size_g, name_te, remarks)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(input.name.trim(), groupId, input.defaultBagSizeG, input.nameTe, input.remarks)
    return this.getById(Number(result.lastInsertRowid))!
  }

  update(id: number, input: UpdateProductInput): Product {
    const groupId = this.resolveProductGroup(input.productGroupName)
    const current = this.db.prepare('SELECT product_group_id FROM product WHERE id = ?').get(id) as
      | { product_group_id: number }
      | undefined
    const groupChanged = current !== undefined && current.product_group_id !== groupId

    if (groupChanged) {
      this.db
        .prepare(
          `UPDATE product
           SET name = ?, product_group_id = ?, name_te = ?, remarks = ?,
               inventory_order = NULL, updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(input.name.trim(), groupId, input.nameTe, input.remarks, id)
    } else {
      this.db
        .prepare(
          `UPDATE product
           SET name = ?, product_group_id = ?, name_te = ?, remarks = ?,
               updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(input.name.trim(), groupId, input.nameTe, input.remarks, id)
    }
    return this.getById(id)!
  }

  /**
   * Write Inventory Product Order for one Product Group.
   * `orderedIds` must be a non-empty permutation of every Product in that group.
   * Assigns 1..n in array order. Other groups are untouched.
   */
  reorderProducts(orderedIds: number[]): void {
    if (orderedIds.length === 0) {
      throw new Error('orderedIds must be a non-empty permutation of one Product Group')
    }

    const seen = new Set<number>()
    for (const id of orderedIds) {
      if (seen.has(id)) {
        throw new Error('orderedIds must be a permutation of one Product Group')
      }
      seen.add(id)
    }

    const getRow = this.db.prepare('SELECT id, product_group_id FROM product WHERE id = ?')
    const rows: { id: number; product_group_id: number }[] = []
    for (const id of orderedIds) {
      const row = getRow.get(id) as { id: number; product_group_id: number } | undefined
      if (!row) {
        throw new Error(`Product ${id} not found`)
      }
      rows.push(row)
    }

    const groupId = rows[0]!.product_group_id
    if (rows.some((r) => r.product_group_id !== groupId)) {
      throw new Error('orderedIds must share one Product Group')
    }

    const siblingCount = (
      this.db
        .prepare('SELECT count(*) AS n FROM product WHERE product_group_id = ?')
        .get(groupId) as { n: number }
    ).n
    if (siblingCount !== orderedIds.length) {
      throw new Error('orderedIds must include every Product in the Product Group')
    }

    const update = this.db.prepare(
      `UPDATE product SET inventory_order = ?, updated_at = datetime('now') WHERE id = ?`
    )
    const apply = this.db.transaction(() => {
      for (let i = 0; i < orderedIds.length; i++) {
        update.run(i + 1, orderedIds[i])
      }
    })
    apply()
  }

  delete(id: number): void {
    const check = this.canDelete(id)
    if (!check.canDelete) {
      throw new Error(check.reason ?? 'Cannot delete this product')
    }
    // Zero Opening Stock rows are left after Rollover for every Product; drop them so
    // an unused Product can leave the Product Master without a silent FK failure.
    this.db.prepare('DELETE FROM opening_stock WHERE product_id = ?').run(id)
    this.db.prepare('DELETE FROM product WHERE id = ?').run(id)
  }

  canDelete(id: number): DeleteCheck {
    if (this.refChecker.hasProductReferences(id)) {
      return { canDelete: false, reason: 'Product is referenced by existing transactions' }
    }
    // Non-zero Opening Stock means the Product still carries Inventory into this day.
    const hasStock = this.db
      .prepare(`SELECT 1 FROM opening_stock WHERE product_id = ? AND qty != 0 LIMIT 1`)
      .get(id)
    if (hasStock !== undefined) {
      return {
        canDelete: false,
        reason: 'Product has Opening Stock for this Business Day'
      }
    }
    return { canDelete: true }
  }

  listProductGroups(): ProductGroup[] {
    return this.db
      .prepare('SELECT id, name FROM product_group ORDER BY name COLLATE NOCASE')
      .all() as ProductGroup[]
  }

  private resolveProductGroup(name: string): number {
    const trimmed = name.trim()
    const existing = this.db
      .prepare('SELECT id FROM product_group WHERE name = ? COLLATE NOCASE')
      .get(trimmed) as { id: number } | undefined

    if (existing) return existing.id

    const result = this.db.prepare('INSERT INTO product_group (name) VALUES (?)').run(trimmed)
    return Number(result.lastInsertRowid)
  }
}
