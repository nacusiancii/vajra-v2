import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SETTINGS,
  addDefaultBagType,
  canRemoveDefaultBagType,
  isPositiveIntegerKg,
  isValidLoadingCharge,
  normalizeDefaultBagTypes,
  removeDefaultBagType,
  setDefaultBagTypeLoading,
  validateDefaultBagTypesUpdate,
  type AppSettings
} from '@domain/settings'
import { SEED_BAG_SIZES } from '@domain/types'

function settings(partial: Partial<AppSettings> = {}): AppSettings {
  return normalizeDefaultBagTypes({
    ...DEFAULT_SETTINGS,
    bagTypes: [...DEFAULT_SETTINGS.bagTypes],
    loadingChargePerBag: { ...DEFAULT_SETTINGS.loadingChargePerBag },
    ...partial
  })
}

describe('DEFAULT_SETTINGS', () => {
  it('defaults to printerless mode', () => {
    expect(DEFAULT_SETTINGS.printerlessMode).toBe(true)
  })
})

describe('seed Default Bag Types', () => {
  it('ships 25, 30, 50 kg with loading ₹0 each', () => {
    expect(DEFAULT_SETTINGS.bagTypes).toEqual([25, 30, 50])
    expect([...SEED_BAG_SIZES]).toEqual([25, 30, 50])
    expect(DEFAULT_SETTINGS.loadingChargePerBag[25]).toBe(0)
    expect(DEFAULT_SETTINGS.loadingChargePerBag[30]).toBe(0)
    expect(DEFAULT_SETTINGS.loadingChargePerBag[50]).toBe(0)
  })
})

describe('isPositiveIntegerKg', () => {
  it('accepts positive integers', () => {
    expect(isPositiveIntegerKg(1)).toBe(true)
    expect(isPositiveIntegerKg(40)).toBe(true)
    expect(isPositiveIntegerKg(50)).toBe(true)
  })

  it('rejects non-positive and non-integer kg', () => {
    expect(isPositiveIntegerKg(0)).toBe(false)
    expect(isPositiveIntegerKg(-25)).toBe(false)
    expect(isPositiveIntegerKg(25.5)).toBe(false)
    expect(isPositiveIntegerKg(NaN)).toBe(false)
  })
})

describe('isValidLoadingCharge', () => {
  it('allows ₹0 and positive rates', () => {
    expect(isValidLoadingCharge(0)).toBe(true)
    expect(isValidLoadingCharge(15)).toBe(true)
  })

  it('rejects negative rates', () => {
    expect(isValidLoadingCharge(-1)).toBe(false)
  })
})

describe('addDefaultBagType', () => {
  it('adds 40 kg with loading ₹0', () => {
    const result = addDefaultBagType(settings(), 40, 0)
    expect('settings' in result).toBe(true)
    if (!('settings' in result)) return
    expect(result.settings.bagTypes).toEqual([25, 30, 40, 50])
    expect(result.settings.loadingChargePerBag[40]).toBe(0)
  })

  it('adds 40 kg with a positive loading rate', () => {
    const result = addDefaultBagType(settings(), 40, 15)
    expect('settings' in result).toBe(true)
    if (!('settings' in result)) return
    expect(result.settings.loadingChargePerBag[40]).toBe(15)
  })

  it('rejects non-positive or non-integer kg', () => {
    expect(addDefaultBagType(settings(), 0, 0)).toEqual({
      error: 'Default Bag Type kg must be a positive integer'
    })
    expect(addDefaultBagType(settings(), -10, 0)).toEqual({
      error: 'Default Bag Type kg must be a positive integer'
    })
    expect(addDefaultBagType(settings(), 40.5, 0)).toEqual({
      error: 'Default Bag Type kg must be a positive integer'
    })
  })

  it('rejects duplicate sizes', () => {
    const result = addDefaultBagType(settings(), 50, 0)
    expect(result).toEqual({ error: '50 kg is already a Default Bag Type' })
  })
})

describe('setDefaultBagTypeLoading — kg immutable, loading editable', () => {
  it('updates loading charge including ₹0', () => {
    const withRate = setDefaultBagTypeLoading(settings(), 50, 20)
    expect('settings' in withRate).toBe(true)
    if (!('settings' in withRate)) return
    expect(withRate.settings.loadingChargePerBag[50]).toBe(20)
    expect(withRate.settings.bagTypes).toEqual([25, 30, 50])

    const zeroed = setDefaultBagTypeLoading(withRate.settings, 50, 0)
    expect('settings' in zeroed).toBe(true)
    if (!('settings' in zeroed)) return
    expect(zeroed.settings.loadingChargePerBag[50]).toBe(0)
  })

  it('does not invent a new bag type when setting loading', () => {
    const result = setDefaultBagTypeLoading(settings(), 40, 10)
    expect(result).toEqual({ error: '40 kg is not in the Default Bag Types catalog' })
  })
})

describe('canRemoveDefaultBagType / removeDefaultBagType', () => {
  it('blocks remove when any Product uses that Default Bag Size', () => {
    const check = canRemoveDefaultBagType([25, 30, 50], 50, 2)
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/2 Products use it as Default Bag Size/)
  })

  it('blocks remove of the last remaining Default Bag Type', () => {
    const check = canRemoveDefaultBagType([40], 40, 0)
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/last Default Bag Type/)
  })

  it('successful remove drops size and its loading rate', () => {
    const prev = settings({
      bagTypes: [25, 30, 40, 50],
      loadingChargePerBag: { 25: 5, 30: 0, 40: 15, 50: 20 }
    })
    const result = removeDefaultBagType(prev, 40, 0)
    expect('settings' in result).toBe(true)
    if (!('settings' in result)) return
    expect(result.settings.bagTypes).toEqual([25, 30, 50])
    expect(result.settings.loadingChargePerBag[40]).toBeUndefined()
    expect(result.settings.loadingChargePerBag[50]).toBe(20)
  })
})

describe('validateDefaultBagTypesUpdate', () => {
  it('rejects emptying the catalog', () => {
    const check = validateDefaultBagTypesUpdate({
      previous: settings(),
      next: settings({ bagTypes: [] }),
      productCountByDefaultBagSize: new Map()
    })
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/cannot be empty/i)
  })

  it('rejects removing an in-use size', () => {
    const check = validateDefaultBagTypesUpdate({
      previous: settings(),
      next: settings({ bagTypes: [25, 30], loadingChargePerBag: { 25: 0, 30: 0 } }),
      productCountByDefaultBagSize: new Map([[50, 1]])
    })
    expect(check.ok).toBe(false)
    expect(check.reason).toMatch(/Default Bag Size/)
  })

  it('accepts adding 40 kg and editing rates', () => {
    const next = settings({
      bagTypes: [25, 30, 40, 50],
      loadingChargePerBag: { 25: 0, 30: 0, 40: 12, 50: 5 }
    })
    const check = validateDefaultBagTypesUpdate({
      previous: settings(),
      next,
      productCountByDefaultBagSize: new Map()
    })
    expect(check.ok).toBe(true)
  })
})
