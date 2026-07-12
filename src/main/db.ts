import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

let db: Database.Database | null = null

/**
 * Schema version, stored in SQLite's \`PRAGMA user_version\`. Bump when the schema
 * changes and add a step to MIGRATIONS that upgrades from the previous version.
 */
const SCHEMA_VERSION = 2

/**
 * Stepwise migrations: MIGRATIONS[n] upgrades a database from version n to n+1.
 * Each step runs inside a transaction together with its user_version bump.
 * Dev phase: older versions are wiped rather than migrated (see openAtCurrentVersion).
 */
const MIGRATIONS: Record<number, (database: Database.Database) => void> = {}

function getDbPath(): string {
  const dir = process.env.VAJRA_USER_DATA || app.getPath('userData')
  return path.join(dir, 'vajra.db')
}

/**
 * Integer ledger schema (paise + grams).
 * Money columns and rates are INTEGER paise; bag sizes and bulk stock are INTEGER grams.
 */
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

/**
 * Delete the DB and its WAL/SHM siblings. Throws on failure — a half-wiped DB
 * must never be silently reopened and stamped with the current version.
 */
function wipeDbFiles(dbPath: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true })
  }
}

function userVersion(database: Database.Database): number {
  return database.pragma('user_version', { simple: true }) as number
}

function hasTables(database: Database.Database): boolean {
  const row = database.prepare(`SELECT count(*) AS n FROM sqlite_master`).get() as { n: number }
  return row.n > 0
}

function open(dbPath: string): Database.Database {
  const database = new Database(dbPath)
  database.pragma('journal_mode = WAL')
  database.pragma('foreign_keys = ON')
  return database
}

/**
 * Open the database at SCHEMA_VERSION.
 *
 * - Fresh (no tables): create the current schema, stamp the version.
 * - Pre-version (tables but user_version 0) or older version: wipe and start
 *   fresh. Fast development mode — no backwards-compatible migrations until
 *   the schema stabilises. Never wipes on open/read errors alone.
 * - Newer version (file from a newer app): fail loudly. Never wipe versioned data.
 */
function openAtCurrentVersion(dbPath: string): Database.Database {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })

  let database = open(dbPath)
  let version = userVersion(database)

  // Dev phase: drop anything older than SCHEMA_VERSION and recreate.
  if ((version === 0 && hasTables(database)) || (version > 0 && version < SCHEMA_VERSION)) {
    database.close()
    wipeDbFiles(dbPath)
    database = open(dbPath)
    version = 0
  }

  if (version > SCHEMA_VERSION) {
    database.close()
    throw new Error(
      `Database is schema v${version}, newer than this app's v${SCHEMA_VERSION} — update the app`
    )
  }

  if (version === 0) {
    database.transaction(() => {
      database.exec(SCHEMA)
      database.pragma(`user_version = ${SCHEMA_VERSION}`)
    })()
    return database
  }

  for (let v = version; v < SCHEMA_VERSION; v++) {
    const step = MIGRATIONS[v]
    if (!step) {
      database.close()
      throw new Error(`No migration from schema v${v} to v${v + 1}`)
    }
    database.transaction(() => {
      step(database)
      database.pragma(`user_version = ${v + 1}`)
    })()
  }
  return database
}

export function getDb(): Database.Database {
  if (!db) {
    db = openAtCurrentVersion(getDbPath())
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
