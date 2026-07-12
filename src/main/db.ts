import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { SCHEMA_IDENTITY } from '../domain/units'

let db: Database.Database | null = null

function getDbPath(): string {
  const dir = process.env.VAJRA_USER_DATA || app.getPath('userData')
  return path.join(dir, 'vajra.db')
}

/**
 * Integer ledger schema (paise + grams).
 * Money columns and rates are INTEGER paise; bag sizes and bulk stock are INTEGER grams.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS schema_identity (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    name  TEXT    NOT NULL
  );

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
    default_bag_size_g   INTEGER CHECK (
      (type = 'bulk'     AND default_bag_size_g IS NOT NULL AND default_bag_size_g IN (25000, 30000, 50000))
      OR
      (type = 'packaged' AND default_bag_size_g IS NULL)
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
    -- Bulk: grams. Packaged: unit count.
    qty              INTEGER NOT NULL,
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
    cash_in             INTEGER NOT NULL DEFAULT 0,
    upi_in              INTEGER NOT NULL DEFAULT 0,
    cash_out            INTEGER NOT NULL DEFAULT 0,
    upi_out             INTEGER NOT NULL DEFAULT 0,
    additional_charges  INTEGER NOT NULL DEFAULT 0,
    loading_charges     INTEGER NOT NULL DEFAULT 0,
    total               INTEGER NOT NULL DEFAULT 0,
    credit_amount       INTEGER NOT NULL DEFAULT 0,
    -- Settlement write-off in paise for RE/PA; 0 for all other types.
    discount_amount     INTEGER NOT NULL DEFAULT 0,
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
    bag_size_g    INTEGER,
    quintal_rate  INTEGER,
    unit_rate     INTEGER,
    qty           REAL    NOT NULL,
    -- Bulk: grams. Packaged: units.
    stock_delta   INTEGER NOT NULL,
    line_total    INTEGER NOT NULL DEFAULT 0
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

function unlinkDbFiles(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${dbPath}${suffix}`
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch {
      // Best-effort; open will fail loudly if the file is truly stuck.
    }
  }
}

/**
 * If an on-disk DB exists but is not the current schema identity, drop it entirely
 * and let the app create a fresh DB. No data migration — day-scoped app.
 */
function ensureSchemaIdentityOrWipe(dbPath: string): void {
  if (!fs.existsSync(dbPath)) return

  let probe: Database.Database | null = null
  try {
    probe = new Database(dbPath, { readonly: true, fileMustExist: true })
    const row = probe.prepare(`SELECT name FROM schema_identity WHERE id = 1`).get() as
      | { name: string }
      | undefined
    if (row?.name === SCHEMA_IDENTITY) return
  } catch {
    // Missing table, corrupt file, or pre-identity schema → wipe.
  } finally {
    probe?.close()
  }

  unlinkDbFiles(dbPath)
}

function stampIdentity(database: Database.Database): void {
  database
    .prepare(
      `INSERT INTO schema_identity (id, name) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name`
    )
    .run(SCHEMA_IDENTITY)
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath()
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    ensureSchemaIdentityOrWipe(dbPath)

    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)
    stampIdentity(db)
    ensureOpenBusinessDay(db)
  }
  return db
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
