import type { Database } from 'better-sqlite3'
import { DEFAULT_SETTINGS, type AppSettings, type LoadingChargeRules } from '../../domain/settings'

const KEY = 'app'

/**
 * Single-row settings store keyed by 'app'. Holds Printerless Mode (ADR-0008),
 * weight-breakpoint Loading Charge rules, and the configurable Bag Types (CONTEXT.md).
 */
export class SettingsRepo {
  constructor(private db: Database) {}

  get(): AppSettings {
    return this.read()
  }

  update(settings: AppSettings): AppSettings {
    const next: AppSettings = {
      ...settings,
      loadingCharge: normalizeLoadingCharge(settings.loadingCharge)
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
    if (!row) return { ...DEFAULT_SETTINGS }
    try {
      // `printerlessMode` was force-locked on (#22); drop it so the new `printerless`
      // default (off) applies instead of a value nobody chose.
      const { printerlessMode: _forcedOn, ...saved } = JSON.parse(
        row.value
      ) as Partial<AppSettings> & {
        printerlessMode?: boolean
      }
      return { ...DEFAULT_SETTINGS, ...saved }
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }
}

/**
 * Validate Loading Charge breakpoints and store them sorted ascending by upToKg.
 * - upToKg: positive and unique
 * - chargePaise / aboveLastPaise: integer paise ≥ 0
 */
export function normalizeLoadingCharge(rules: LoadingChargeRules): LoadingChargeRules {
  if (!Number.isInteger(rules.aboveLastPaise) || rules.aboveLastPaise < 0) {
    throw new Error('aboveLastPaise must be an integer ≥ 0')
  }
  const seen = new Set<number>()
  for (const bp of rules.breakpoints) {
    if (!(typeof bp.upToKg === 'number' && bp.upToKg > 0)) {
      throw new Error('Breakpoint upToKg must be positive')
    }
    if (seen.has(bp.upToKg)) {
      throw new Error(`Duplicate breakpoint upToKg: ${bp.upToKg}`)
    }
    seen.add(bp.upToKg)
    if (!Number.isInteger(bp.chargePaise) || bp.chargePaise < 0) {
      throw new Error('Breakpoint chargePaise must be an integer ≥ 0')
    }
  }
  const breakpoints = [...rules.breakpoints].sort((a, b) => a.upToKg - b.upToKg)
  return { breakpoints, aboveLastPaise: rules.aboveLastPaise }
}
