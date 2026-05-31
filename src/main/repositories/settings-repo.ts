import type { Database } from 'better-sqlite3'
import { DEFAULT_SETTINGS, type AppSettings } from '../../domain/settings'

const KEY = 'app'

/**
 * Single-row settings store keyed by 'app'. Holds Printerless Mode (ADR-0008), the
 * Loading Charge rules per Bag Type, and the configurable Bag Types (CONTEXT.md).
 */
export class SettingsRepo {
  constructor(private db: Database) {}

  get(): AppSettings {
    const row = this.db.prepare(`SELECT value FROM setting WHERE key = ?`).get(KEY) as
      | { value: string }
      | undefined
    if (!row) return { ...DEFAULT_SETTINGS }
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<AppSettings>) }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  update(settings: AppSettings): AppSettings {
    this.db
      .prepare(
        `INSERT INTO setting (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(KEY, JSON.stringify(settings))
    return this.get()
  }
}
