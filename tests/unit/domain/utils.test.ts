import { describe, it, expect } from 'vitest'
import { isNameTaken } from '@domain/utils'

describe('isNameTaken', () => {
  const existing = [
    { id: 1, name: 'Ravi Kumar' },
    { id: 2, name: 'Suresh Babu' }
  ]

  it('returns true for exact match', () => {
    expect(isNameTaken('Ravi Kumar', existing)).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isNameTaken('ravi kumar', existing)).toBe(true)
    expect(isNameTaken('RAVI KUMAR', existing)).toBe(true)
  })

  it('returns false for unique name', () => {
    expect(isNameTaken('New Name', existing)).toBe(false)
  })

  it('excludes the entity being edited', () => {
    expect(isNameTaken('Ravi Kumar', existing, 1)).toBe(false)
  })

  it('still catches conflicts with other entities when editing', () => {
    expect(isNameTaken('Suresh Babu', existing, 1)).toBe(true)
  })
})
