import type { Database } from 'better-sqlite3'
import { DEFAULT_SETTINGS, type AppSettings } from '../../domain/settings'

const KEY = 'app'

/**
 * Single-row settings store keyed by 'app'. Holds Printerless Mode (ADR-0008),
 * weight-breakpoint Loading Charge rules, and the configurable Bag Types (CONTEXT.md).
 */
export class SettingsRepo {
  constructor(private db: Database) {}

  get(): AppSettings {
    return lockPrinterless(this.read())
  }

  update(settings: AppSettings): AppSettings {
    const next = lockPrinterless(settings)
    this.db
      .prepare(
        `INSERT INTO setting (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      )
      .run(KEY, JSON.stringify(next))
    return this.get()
  }

  private read(): AppSettings {
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
}

/**
 * Temporary: no printer driver yet (#22). Force printerless on every read/write
 * so old rows and UI saves cannot turn it off. Drop when #28 ships.
 */
function lockPrinterless(settings: AppSettings): AppSettings {
  return { ...settings, printerlessMode: true }
}
