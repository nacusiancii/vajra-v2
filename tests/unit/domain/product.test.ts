import { describe, it, expect } from 'vitest'
import {
  CreateProductSchema,
  isDefaultBagSizeInCatalog,
  isValidBagSize,
  validateBulkDefaultBagSize
} from '@domain/product'
import { SEED_BAG_SIZES } from '@domain/types'

describe('CreateProductSchema', () => {
  it('accepts valid bulk product', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Toor Dal Premium',
      productGroupName: 'Toor Dal',
      type: 'bulk',
      defaultBagSizeKg: 50,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid packaged product (null bag size)', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Atta 1kg',
      productGroupName: 'Flour',
      type: 'packaged',
      defaultBagSizeKg: null,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(true)
  })

  it('rejects bulk product without bag size', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Toor Dal',
      productGroupName: 'Toor Dal',
      type: 'bulk',
      defaultBagSizeKg: null,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('rejects packaged product with bag size', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Atta 1kg',
      productGroupName: 'Flour',
      type: 'packaged',
      defaultBagSizeKg: 25,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = CreateProductSchema.safeParse({
      name: '',
      productGroupName: 'Toor Dal',
      type: 'bulk',
      defaultBagSizeKg: 50,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty product group', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Toor Dal',
      productGroupName: '',
      type: 'bulk',
      defaultBagSizeKg: 50,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-positive Default Bag Size shape', () => {
    for (const kg of [0, -25, 25.5]) {
      const result = CreateProductSchema.safeParse({
        name: 'Odd Dal',
        productGroupName: 'Dal',
        type: 'bulk',
        defaultBagSizeKg: kg,
        nameTe: null,
        remarks: null
      })
      expect(result.success).toBe(false)
    }
  })
})

describe('isValidBagSize', () => {
  it('accepts any positive integer kg (catalog membership is separate)', () => {
    expect(isValidBagSize(25)).toBe(true)
    expect(isValidBagSize(30)).toBe(true)
    expect(isValidBagSize(50)).toBe(true)
    expect(isValidBagSize(40)).toBe(true)
    expect(isValidBagSize(1)).toBe(true)
  })

  it('rejects non-positive and non-integer values', () => {
    expect(isValidBagSize(0)).toBe(false)
    expect(isValidBagSize(-25)).toBe(false)
    expect(isValidBagSize(10.5)).toBe(false)
  })
})

describe('catalog membership on product create', () => {
  const seed = [...SEED_BAG_SIZES]
  const with40 = [25, 30, 40, 50]

  it('accepts all seed bag sizes for bulk against the seed catalog', () => {
    for (const kg of seed) {
      expect(validateBulkDefaultBagSize('bulk', kg, seed)).toBeNull()
      expect(isDefaultBagSizeInCatalog(kg, seed)).toBe(true)
    }
  })

  it('rejects Default Bag Size 40 when 40 is not in the catalog', () => {
    expect(validateBulkDefaultBagSize('bulk', 40, seed)).toMatch(
      /not in the Default Bag Types catalog/
    )
    expect(isDefaultBagSizeInCatalog(40, seed)).toBe(false)
  })

  it('accepts Default Bag Size 40 when 40 is in the catalog', () => {
    expect(validateBulkDefaultBagSize('bulk', 40, with40)).toBeNull()
    expect(isDefaultBagSizeInCatalog(40, with40)).toBe(true)
  })

  it('CreateProductSchema still accepts 40 at shape layer (membership checked with catalog)', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Odd Dal',
      productGroupName: 'Dal',
      type: 'bulk',
      defaultBagSizeKg: 40,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(true)
    // Membership is enforced via validateBulkDefaultBagSize / ProductRepo
    expect(validateBulkDefaultBagSize('bulk', 40, seed)).not.toBeNull()
  })
})
