import { SEED_BAG_SIZES, type BagSizeKg } from './types'

/**
 * App-level configuration (CONTEXT.md, ADR-0008). Persisted as a single JSON row.
 */
export interface AppSettings {
  /** When on, finishing a Sale shows the would-be slip on screen instead of printing. */
  printerlessMode: boolean
  /** Shop / company name printed on the Credit Voucher front side. */
  companyName: string
  /**
   * Default Bag Types catalog — positive integer kg sizes the shop uses as
   * Product Default Bag Size and as one-tap bag choices on Sale/Purchase lines.
   * Seeded with 25 / 30 / 50; never empty.
   */
  bagTypes: BagSizeKg[]
  /**
   * Loading Charge as a rupee rate per bag, keyed by Default Bag Type kg.
   * ₹0 is allowed (seed default). Only rates for sizes in `bagTypes` matter.
   */
  loadingChargePerBag: Record<number, number>
  /**
   * Global max Drafts for the open Business Day (Sale + Purchase share one pool).
   * ADR-0010 — default 5; no per-type caps.
   */
  draftCap: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Locked on until thermal print lands (#22 / #28).
  printerlessMode: true,
  companyName: '',
  bagTypes: [...SEED_BAG_SIZES],
  loadingChargePerBag: { 25: 0, 30: 0, 50: 0 },
  draftCap: 5
}

/** Positive integer kg (Default Bag Type / Default Bag Size shape). */
export function isPositiveIntegerKg(kg: number): boolean {
  return Number.isInteger(kg) && kg > 0
}

/** Loading charge ₹/bag — non-negative finite; ₹0 allowed. */
export function isValidLoadingCharge(rate: number): boolean {
  return Number.isFinite(rate) && rate >= 0
}

export interface CatalogCheck {
  ok: boolean
  reason?: string
}

/**
 * Whether a size may be used as Product Default Bag Size — membership in the
 * current Default Bag Types catalog.
 */
export function isInDefaultBagTypeCatalog(kg: number, catalog: readonly number[]): boolean {
  return isPositiveIntegerKg(kg) && catalog.includes(kg)
}

/**
 * Guardrails for removing a Default Bag Type:
 * - cannot empty the catalog
 * - cannot remove a size any Product uses as Default Bag Size
 */
export function canRemoveDefaultBagType(
  bagTypes: readonly number[],
  kg: number,
  productsUsingKg: number
): CatalogCheck {
  if (!bagTypes.includes(kg)) {
    return { ok: false, reason: `${kg} kg is not in the Default Bag Types catalog` }
  }
  if (bagTypes.length <= 1) {
    return { ok: false, reason: 'Cannot remove the last Default Bag Type' }
  }
  if (productsUsingKg > 0) {
    return {
      ok: false,
      reason: `Cannot remove ${kg} kg: ${productsUsingKg} Product${productsUsingKg === 1 ? '' : 's'} use it as Default Bag Size`
    }
  }
  return { ok: true }
}

/**
 * Validate a proposed Default Bag Types catalog + loading rates before persist.
 * Enforces positive-integer kg, non-empty catalog, non-negative rates, and
 * that no in-use Product Default Bag Size was dropped.
 */
export function validateDefaultBagTypesUpdate(args: {
  next: AppSettings
  previous: AppSettings
  /** Count of Products whose Default Bag Size equals each kg (for removed sizes). */
  productCountByDefaultBagSize: Map<number, number>
}): CatalogCheck {
  const { next, previous, productCountByDefaultBagSize } = args
  const types = next.bagTypes

  if (!Array.isArray(types) || types.length === 0) {
    return { ok: false, reason: 'Default Bag Types catalog cannot be empty' }
  }

  const seen = new Set<number>()
  for (const kg of types) {
    if (!isPositiveIntegerKg(kg)) {
      return {
        ok: false,
        reason: 'Each Default Bag Type must be a positive integer kg'
      }
    }
    if (seen.has(kg)) {
      return { ok: false, reason: `Duplicate Default Bag Type: ${kg} kg` }
    }
    seen.add(kg)

    const rate = next.loadingChargePerBag[kg] ?? 0
    if (!isValidLoadingCharge(rate)) {
      return {
        ok: false,
        reason: `Loading charge for ${kg} kg must be ₹0 or a positive amount`
      }
    }
  }

  for (const kg of previous.bagTypes) {
    if (seen.has(kg)) continue
    const inUse = productCountByDefaultBagSize.get(kg) ?? 0
    const check = canRemoveDefaultBagType(previous.bagTypes, kg, inUse)
    if (!check.ok) return check
  }

  return { ok: true }
}

/**
 * Normalize settings after a successful catalog update: sort bag types ascending
 * and drop loading rates for sizes no longer in the catalog.
 */
export function normalizeDefaultBagTypes(settings: AppSettings): AppSettings {
  const bagTypes = [...new Set(settings.bagTypes.filter(isPositiveIntegerKg))].sort((a, b) => a - b)
  const loadingChargePerBag: Record<number, number> = {}
  for (const kg of bagTypes) {
    const rate = settings.loadingChargePerBag[kg] ?? 0
    loadingChargePerBag[kg] = isValidLoadingCharge(rate) ? rate : 0
  }
  return { ...settings, bagTypes, loadingChargePerBag }
}

/**
 * Pure helper for Settings UI: add a Default Bag Type (kg immutable thereafter).
 * Returns an error string or the next settings draft.
 */
export function addDefaultBagType(
  settings: AppSettings,
  kg: number,
  loadingCharge: number = 0
): { settings: AppSettings } | { error: string } {
  if (!isPositiveIntegerKg(kg)) {
    return { error: 'Default Bag Type kg must be a positive integer' }
  }
  if (!isValidLoadingCharge(loadingCharge)) {
    return { error: 'Loading charge must be ₹0 or a positive amount' }
  }
  if (settings.bagTypes.includes(kg)) {
    return { error: `${kg} kg is already a Default Bag Type` }
  }
  return {
    settings: normalizeDefaultBagTypes({
      ...settings,
      bagTypes: [...settings.bagTypes, kg],
      loadingChargePerBag: { ...settings.loadingChargePerBag, [kg]: loadingCharge }
    })
  }
}

/**
 * Pure helper: remove a Default Bag Type and its loading rate when guardrails pass.
 */
export function removeDefaultBagType(
  settings: AppSettings,
  kg: number,
  productsUsingKg: number
): { settings: AppSettings } | { error: string } {
  const check = canRemoveDefaultBagType(settings.bagTypes, kg, productsUsingKg)
  if (!check.ok) {
    return { error: check.reason ?? 'Cannot remove this Default Bag Type' }
  }
  const restRates = { ...settings.loadingChargePerBag }
  delete restRates[kg]
  return {
    settings: normalizeDefaultBagTypes({
      ...settings,
      bagTypes: settings.bagTypes.filter((b) => b !== kg),
      loadingChargePerBag: restRates
    })
  }
}

/**
 * Pure helper: edit loading charge only (kg is immutable after create).
 */
export function setDefaultBagTypeLoading(
  settings: AppSettings,
  kg: number,
  loadingCharge: number
): { settings: AppSettings } | { error: string } {
  if (!settings.bagTypes.includes(kg)) {
    return { error: `${kg} kg is not in the Default Bag Types catalog` }
  }
  if (!isValidLoadingCharge(loadingCharge)) {
    return { error: 'Loading charge must be ₹0 or a positive amount' }
  }
  return {
    settings: {
      ...settings,
      loadingChargePerBag: { ...settings.loadingChargePerBag, [kg]: loadingCharge }
    }
  }
}
