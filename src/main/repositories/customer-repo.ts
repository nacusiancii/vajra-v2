import type { Database } from 'better-sqlite3'
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  Place,
  DeleteCheck
} from '../../domain/types'
import { nullReferenceChecker, type ReferenceChecker } from '../../domain/types'

interface CustomerRow {
  id: number
  name: string
  place_id: number
  place_name: string
  phone: string | null
  name_te: string | null
  place_te: string | null
  remarks: string | null
  created_at: string
  updated_at: string
}

function rowToCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    name: row.name,
    placeId: row.place_id,
    placeName: row.place_name,
    phone: row.phone,
    nameTe: row.name_te,
    placeTe: row.place_te,
    remarks: row.remarks,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export class CustomerRepo {
  private refChecker: ReferenceChecker

  constructor(
    private db: Database,
    refChecker?: ReferenceChecker
  ) {
    this.refChecker = refChecker ?? nullReferenceChecker
  }

  list(): Customer[] {
    const rows = this.db
      .prepare(
        `SELECT c.*, p.name AS place_name
         FROM customer c
         JOIN place p ON p.id = c.place_id
         ORDER BY c.name COLLATE NOCASE`
      )
      .all() as CustomerRow[]
    return rows.map(rowToCustomer)
  }

  getById(id: number): Customer | undefined {
    const row = this.db
      .prepare(
        `SELECT c.*, p.name AS place_name
         FROM customer c
         JOIN place p ON p.id = c.place_id
         WHERE c.id = ?`
      )
      .get(id) as CustomerRow | undefined
    return row ? rowToCustomer(row) : undefined
  }

  create(input: CreateCustomerInput): Customer {
    const placeId = this.resolvePlace(input.placeName)
    const result = this.db
      .prepare(
        `INSERT INTO customer (name, place_id, phone, name_te, place_te, remarks)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(input.name.trim(), placeId, input.phone, input.nameTe, input.placeTe, input.remarks)
    return this.getById(Number(result.lastInsertRowid))!
  }

  update(id: number, input: UpdateCustomerInput): Customer {
    const placeId = this.resolvePlace(input.placeName)
    this.db
      .prepare(
        `UPDATE customer
         SET name = ?, place_id = ?, phone = ?, name_te = ?, place_te = ?, remarks = ?,
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(input.name.trim(), placeId, input.phone, input.nameTe, input.placeTe, input.remarks, id)
    return this.getById(id)!
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM customer WHERE id = ?').run(id)
  }

  canDelete(id: number): DeleteCheck {
    if (this.refChecker.hasCustomerReferences(id)) {
      return { canDelete: false, reason: 'Customer is referenced by existing transactions' }
    }
    return { canDelete: true }
  }

  listPlaces(): Place[] {
    return this.db
      .prepare('SELECT id, name FROM place ORDER BY name COLLATE NOCASE')
      .all() as Place[]
  }

  private resolvePlace(name: string): number {
    const trimmed = name.trim()
    const existing = this.db
      .prepare('SELECT id FROM place WHERE name = ? COLLATE NOCASE')
      .get(trimmed) as { id: number } | undefined

    if (existing) return existing.id

    const result = this.db.prepare('INSERT INTO place (name) VALUES (?)').run(trimmed)
    return Number(result.lastInsertRowid)
  }
}
