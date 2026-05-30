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
    default_bag_size_kg  INTEGER CHECK (
      (type = 'bulk'     AND default_bag_size_kg IS NOT NULL AND default_bag_size_kg IN (25, 30, 50))
      OR
      (type = 'packaged' AND default_bag_size_kg IS NULL)
    ),
    name_te              TEXT,
    remarks              TEXT,
    created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath())
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.exec(SCHEMA)
  }
  return db
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}
