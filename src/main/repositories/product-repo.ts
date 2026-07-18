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
         ORDER BY p.name COLLATE NOCASE`
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
    this.db
      .prepare(
        `UPDATE product
         SET name = ?, product_group_id = ?, name_te = ?, remarks = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(input.name.trim(), groupId, input.nameTe, input.remarks, id)
    return this.getById(id)!
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
