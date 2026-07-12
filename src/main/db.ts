import Database from 'better-sqlite3'
import path from 'node:path'
import { app } from 'electron'

let db: Database.Database | null = null

function getDbPath(): string {
  const dir = process.env.VAJRA_USER_DATA || app.getPath('userData')
  return path.join(dir, 'vajra.db')
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS place (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    place_id    INTEGER NOT NULL REFERENCES place(id),
    phone       TEXT,
    name_te     TEXT,
    place_te    TEXT,
    remarks     TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product_group (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS product (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    name                 TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    product_group_id     INTEGER NOT NULL REFERENCES product_group(id),
    type                 TEXT    NOT NULL CHECK (type IN ('packaged', 'bulk')),
    -- Default Bag Size: positive integer kg from Settings Default Bag Types catalog
    -- (not a closed 25/30/50 set — membership enforced in domain/repo layer).
    default_bag_size_kg  INTEGER CHECK (
      (type = 'bulk'     AND default_bag_size_kg IS NOT NULL AND default_bag_size_kg > 0)
      OR
      (type = 'packaged' AND default_bag_size_kg IS NULL)
    ),
    name_te              TEXT,
    remarks              TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS business_day (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    start_date      TEXT    NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    closed_at       TEXT,
    -- Monotonic Credit Voucher counter for the day. Each print reserves a fresh number,
    -- so reprints (e.g. after a price change) burn the old one and leave gaps.
    voucher_counter INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS opening_stock (
    business_day_id  INTEGER NOT NULL REFERENCES business_day(id),
    product_id       INTEGER NOT NULL REFERENCES product(id),
    qty              REAL    NOT NULL,
    PRIMARY KEY (business_day_id, product_id)
  );

  CREATE TABLE IF NOT EXISTS txn (
    id                  TEXT    PRIMARY KEY,
    business_day_id     INTEGER NOT NULL REFERENCES business_day(id),
    type                TEXT    NOT NULL CHECK (type IN ('SA','PU','RE','PA','EX','IN','ST')),
    seq                 INTEGER NOT NULL,
    voucher_seq         INTEGER,
    sale_mode           TEXT    CHECK (sale_mode IN ('cash','credit')),
    customer_id         INTEGER REFERENCES customer(id),
    walkin_name         TEXT,
    walkin_place        TEXT,
    walkin_phone        TEXT,
    label               TEXT,
    cash_in             REAL    NOT NULL DEFAULT 0,
    upi_in              REAL    NOT NULL DEFAULT 0,
    cash_out            REAL    NOT NULL DEFAULT 0,
    upi_out             REAL    NOT NULL DEFAULT 0,
    additional_charges  REAL    NOT NULL DEFAULT 0,
    loading_charges     REAL    NOT NULL DEFAULT 0,
    total               REAL    NOT NULL DEFAULT 0,
    credit_amount       REAL    NOT NULL DEFAULT 0,
    -- Settlement write-off in rupees for RE/PA; 0 for all other types.
    discount_amount     REAL    NOT NULL DEFAULT 0,
    remarks             TEXT,
    voided              INTEGER NOT NULL DEFAULT 0,
    successor_id        TEXT    REFERENCES txn(id),
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS txn_line (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    txn_id        TEXT    NOT NULL REFERENCES txn(id) ON DELETE CASCADE,
    side          TEXT    NOT NULL DEFAULT 'single' CHECK (side IN ('single','source','target')),
    product_id    INTEGER NOT NULL REFERENCES product(id),
    bag_size_kg   INTEGER,
    quintal_rate  REAL,
    unit_rate     REAL,
    qty           REAL    NOT NULL,
    stock_delta   REAL    NOT NULL,
    line_total    REAL    NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_txn_day      ON txn(business_day_id);
  CREATE INDEX IF NOT EXISTS idx_txn_line_txn ON txn_line(txn_id);

  CREATE TABLE IF NOT EXISTS setting (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
  );

  -- Day-scoped parked carts outside the transactional ledger (ADR-0010).
  -- Payload is JSON cart state; never contributes to Inventory or drawer totals.
  CREATE TABLE IF NOT EXISTS draft (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    business_day_id  INTEGER NOT NULL REFERENCES business_day(id),
    type             TEXT    NOT NULL CHECK (type IN ('SA', 'PU')),
    payload          TEXT    NOT NULL,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_draft_day ON draft(business_day_id);
`

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)
    migrate(db)
    ensureOpenBusinessDay(db)
  }
  return db
}

/** Additive, idempotent migrations for databases created before a column existed. */
function migrate(database: Database.Database): void {
  const dayColumns = database.prepare(`PRAGMA table_info(business_day)`).all() as Array<{
    name: string
  }>
  if (!dayColumns.some((c) => c.name === 'voucher_counter')) {
    database.exec(`ALTER TABLE business_day ADD COLUMN voucher_counter INTEGER NOT NULL DEFAULT 0`)
  }

  const txnColumns = database.prepare(`PRAGMA table_info(txn)`).all() as Array<{ name: string }>
  if (!txnColumns.some((c) => c.name === 'discount_amount')) {
    database.exec(`ALTER TABLE txn ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0`)
  }

  // #63: Default Bag Size is any positive integer kg from the Settings catalog,
  // not the old closed CHECK (25, 30, 50). SQLite cannot ALTER CHECK — rebuild.
  migrateProductDefaultBagSizeCheck(database)
}

/**
 * Rebuild `product` when the table still has the closed bag-size CHECK.
 * Detected via sqlite_master SQL text; no-op once already migrated / fresh schema.
 */
function migrateProductDefaultBagSizeCheck(database: Database.Database): void {
  const row = database
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'product'`)
    .get() as { sql: string } | undefined
  if (!row?.sql) return
  // Old schema only: default_bag_size_kg IN (25, 30, 50)
  if (!row.sql.includes('default_bag_size_kg IN (25, 30, 50)')) return

  database.pragma('foreign_keys = OFF')
  const rebuild = database.transaction(() => {
    database.exec(`
      CREATE TABLE product__new (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        name                 TEXT    NOT NULL UNIQUE COLLATE NOCASE,
        product_group_id     INTEGER NOT NULL REFERENCES product_group(id),
        type                 TEXT    NOT NULL CHECK (type IN ('packaged', 'bulk')),
        default_bag_size_kg  INTEGER CHECK (
          (type = 'bulk'     AND default_bag_size_kg IS NOT NULL AND default_bag_size_kg > 0)
          OR
          (type = 'packaged' AND default_bag_size_kg IS NULL)
        ),
        name_te              TEXT,
        remarks              TEXT,
        created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO product__new
        (id, name, product_group_id, type, default_bag_size_kg, name_te, remarks, created_at, updated_at)
      SELECT id, name, product_group_id, type, default_bag_size_kg, name_te, remarks, created_at, updated_at
      FROM product;
      DROP TABLE product;
      ALTER TABLE product__new RENAME TO product;
    `)
  })
  rebuild()
  database.pragma('foreign_keys = ON')
}

/**
 * Vajra always has exactly one open Business Day (ADR-0001). On first launch there is
 * none, so bootstrap one anchored to today with empty Opening Stock. Subsequent days are
 * opened by Rollover approval.
 */
function ensureOpenBusinessDay(database: Database.Database): void {
  const open = database.prepare(`SELECT id FROM business_day WHERE status = 'open'`).get()
  if (!open) {
    database.prepare(`INSERT INTO business_day (start_date) VALUES (date('now'))`).run()
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
