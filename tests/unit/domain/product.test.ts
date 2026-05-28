import { describe, it, expect } from 'vitest'
import {
  CreateProductSchema,
  isNameTaken,
  checkImmutableViolation,
  isValidBagSize
} from '@domain/product'
import type { Product } from '@domain/types'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    name: 'Toor Dal Premium',
    productGroupId: 1,
    productGroupName: 'Toor Dal',
    type: 'bulk',
    defaultBagSizeKg: 50,
    nameTe: null,
    remarks: null,
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00',
    ...overrides
  }
}

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
})

describe('isNameTaken', () => {
  const existing = [
    { id: 1, name: 'Toor Dal Premium' },
    { id: 2, name: 'Chana Dal' }
  ]

  it('returns true for exact match', () => {
    expect(isNameTaken('Toor Dal Premium', existing)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isNameTaken('toor dal premium', existing)).toBe(true)
  })

  it('returns false for unique name', () => {
    expect(isNameTaken('Moong Dal', existing)).toBe(false)
  })

  it('excludes the product being edited', () => {
    expect(isNameTaken('Toor Dal Premium', existing, 1)).toBe(false)
  })
})

describe('checkImmutableViolation', () => {
  const product = makeProduct({ type: 'bulk', defaultBagSizeKg: 50 })

  it('returns empty array when no immutable fields change', () => {
    expect(checkImmutableViolation(product, {})).toEqual([])
  })

  it('detects type change', () => {
    const violations = checkImmutableViolation(product, { type: 'packaged' })
    expect(violations).toContain('type')
  })

  it('detects bag size change', () => {
    const violations = checkImmutableViolation(product, { defaultBagSizeKg: 25 })
    expect(violations).toContain('defaultBagSizeKg')
  })

  it('allows same values', () => {
    const violations = checkImmutableViolation(product, { type: 'bulk', defaultBagSizeKg: 50 })
    expect(violations).toEqual([])
  })
})

describe('isValidBagSize', () => {
  it('accepts 25, 30, 50', () => {
    expect(isValidBagSize(25)).toBe(true)
    expect(isValidBagSize(30)).toBe(true)
    expect(isValidBagSize(50)).toBe(true)
  })

  it('rejects other values', () => {
    expect(isValidBagSize(10)).toBe(false)
    expect(isValidBagSize(100)).toBe(false)
  })
})
