import type { Database } from 'better-sqlite3'
import {
  DEFAULT_SETTINGS,
  normalizeDefaultBagTypes,
  validateDefaultBagTypesUpdate,
  type AppSettings
} from '../../domain/settings'

const KEY = 'app'

function cloneDefaults(): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    bagTypes: [...DEFAULT_SETTINGS.bagTypes],
    loadingChargePerBag: { ...DEFAULT_SETTINGS.loadingChargePerBag }
  }
}

/**
 * Single-row settings store keyed by 'app'. Holds Printerless Mode (ADR-0008),
 * Default Bag Types catalog + Loading Charge rates (CONTEXT.md), and draft cap.
 */
export class SettingsRepo {
  constructor(private db: Database) {}

  get(): AppSettings {
    return lockPrinterless(this.read())
  }

  update(settings: AppSettings): AppSettings {
    const previous = this.get()
    const next = lockPrinterless(normalizeDefaultBagTypes(settings))
    const productCountByDefaultBagSize = this.productCountByDefaultBagSize()

    const check = validateDefaultBagTypesUpdate({
      next,
      previous,
      productCountByDefaultBagSize
    })
    if (!check.ok) {
      throw new Error(check.reason ?? 'Invalid Default Bag Types catalog')
    }

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
    if (!row) return cloneDefaults()
    try {
      const merged: AppSettings = {
        ...cloneDefaults(),
        ...(JSON.parse(row.value) as Partial<AppSettings>)
      }
      // Ensure bagTypes is a real array even if stored JSON was partial/corrupt.
      if (!Array.isArray(merged.bagTypes) || merged.bagTypes.length === 0) {
        merged.bagTypes = [...DEFAULT_SETTINGS.bagTypes]
      }
      if (!merged.loadingChargePerBag || typeof merged.loadingChargePerBag !== 'object') {
        merged.loadingChargePerBag = { ...DEFAULT_SETTINGS.loadingChargePerBag }
      }
      return normalizeDefaultBagTypes(merged)
    } catch {
      return cloneDefaults()
    }
  }

  /** How many Products use each Default Bag Size (for remove guardrails). */
  productCountByDefaultBagSize(): Map<number, number> {
    const rows = this.db
      .prepare(
        `SELECT default_bag_size_kg AS kg, COUNT(*) AS n
         FROM product
         WHERE type = 'bulk' AND default_bag_size_kg IS NOT NULL
         GROUP BY default_bag_size_kg`
      )
      .all() as Array<{ kg: number; n: number }>
    return new Map(rows.map((r) => [r.kg, r.n]))
  }
}

/**
 * Temporary: no printer driver yet (#22). Force printerless on every read/write
 * so old rows and UI saves cannot turn it off. Drop when #28 ships.
 */
function lockPrinterless(settings: AppSettings): AppSettings {
  return { ...settings, printerlessMode: true }
}
