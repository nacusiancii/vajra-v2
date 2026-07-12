import { describe, it, expect } from 'vitest'
import { CreateProductSchema, isValidBagSizeG } from '@domain/product'

describe('CreateProductSchema', () => {
  it('accepts valid bulk product', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Toor Dal Premium',
      productGroupName: 'Toor Dal',
      type: 'bulk',
      defaultBagSizeG: 50_000,
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
      defaultBagSizeG: null,
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
      defaultBagSizeG: null,
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
      defaultBagSizeG: 25_000,
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
      defaultBagSizeG: 50_000,
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
      defaultBagSizeG: 50_000,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('rejects bulk with non-shipped bag size', () => {
    const result = CreateProductSchema.safeParse({
      name: 'Toor Dal',
      productGroupName: 'Toor Dal',
      type: 'bulk',
      defaultBagSizeG: 40_000,
      nameTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })
})

describe('isValidBagSizeG', () => {
  it('accepts 25/30/50 kg as grams', () => {
    expect(isValidBagSizeG(25_000)).toBe(true)
    expect(isValidBagSizeG(30_000)).toBe(true)
    expect(isValidBagSizeG(50_000)).toBe(true)
  })

  it('rejects other sizes', () => {
    expect(isValidBagSizeG(40_000)).toBe(false)
    expect(isValidBagSizeG(50)).toBe(false)
  })
})
