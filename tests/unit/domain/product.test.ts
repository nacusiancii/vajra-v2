import { describe, it, expect } from 'vitest'
import { CreateProductSchema, isValidBagSize } from '@domain/product'

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

  it('rejects sizes Settings UI can still add (configurability split)', () => {
    expect(isValidBagSize(40)).toBe(false)
    expect(isValidBagSize(20)).toBe(false)
    expect(isValidBagSize(1)).toBe(false)
  })
})

describe('CreateProductSchema bag size membership (current gap)', () => {
  it('accepts all shipped bag sizes for bulk', () => {
    for (const kg of [25, 30, 50]) {
      const result = CreateProductSchema.safeParse({
        name: `Dal ${kg}`,
        productGroupName: 'Dal',
        type: 'bulk',
        defaultBagSizeKg: kg,
        nameTe: null,
        remarks: null
      })
      expect(result.success).toBe(true)
    }
  })

  it('does not reject non-shipped bag sizes at schema layer', () => {
    // Documents: domain schema is looser than DB CHECK (25,30,50) and isValidBagSize
    const result = CreateProductSchema.safeParse({
      name: 'Odd Dal',
      productGroupName: 'Dal',
      type: 'bulk',
      defaultBagSizeKg: 40,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(true)
  })
})
