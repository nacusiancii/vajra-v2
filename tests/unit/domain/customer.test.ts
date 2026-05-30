import { describe, it, expect } from 'vitest'
import { CreateCustomerSchema, checkDuplicateWarning } from '@domain/customer'
import type { Customer } from '@domain/types'

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 1,
    name: 'Ravi Kumar',
    placeId: 1,
    placeName: 'Guntur',
    phone: '9876543210',
    nameTe: null,
    placeTe: null,
    remarks: null,
    createdAt: '2025-01-01T00:00:00',
    updatedAt: '2025-01-01T00:00:00',
    ...overrides
  }
}

describe('CreateCustomerSchema', () => {
  it('accepts valid input', () => {
    const result = CreateCustomerSchema.safeParse({
      name: 'Ravi Kumar',
      placeName: 'Guntur',
      phone: '9876543210',
      nameTe: null,
      placeTe: null,
      remarks: null
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateCustomerSchema.safeParse({
      name: '',
      placeName: 'Guntur',
      phone: null,
      nameTe: null,
      placeTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty place', () => {
    const result = CreateCustomerSchema.safeParse({
      name: 'Ravi',
      placeName: '  ',
      phone: null,
      nameTe: null,
      placeTe: null,
      remarks: null
    })
    expect(result.success).toBe(false)
  })

  it('trims whitespace and converts empty strings to null', () => {
    const result = CreateCustomerSchema.safeParse({
      name: '  Ravi Kumar  ',
      placeName: '  Guntur  ',
      phone: '',
      nameTe: '',
      placeTe: '',
      remarks: ''
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Ravi Kumar')
      expect(result.data.placeName).toBe('Guntur')
      expect(result.data.phone).toBeNull()
      expect(result.data.nameTe).toBeNull()
    }
  })
})

describe('checkDuplicateWarning', () => {
  const existing = [
    makeCustomer({ id: 1, name: 'Ravi Kumar', placeName: 'Guntur', phone: '9876543210' }),
    makeCustomer({ id: 2, name: 'Suresh Babu', placeName: 'Guntur', phone: '1234567890' }),
    makeCustomer({ id: 3, name: 'No Phone', placeName: 'Guntur', phone: null })
  ]

  it('warns when same place and phone match', () => {
    const warning = checkDuplicateWarning('Guntur', '9876543210', existing)
    expect(warning).not.toBeNull()
    expect(warning!.matchingCustomers[0].name).toBe('Ravi Kumar')
  })

  it('no warning when phone is null', () => {
    const warning = checkDuplicateWarning('Guntur', null, existing)
    expect(warning).toBeNull()
  })

  it('no warning when phone is empty', () => {
    const warning = checkDuplicateWarning('Guntur', '', existing)
    expect(warning).toBeNull()
  })

  it('no warning when place does not match', () => {
    const warning = checkDuplicateWarning('Vijayawada', '9876543210', existing)
    expect(warning).toBeNull()
  })

  it('excludes the customer being edited', () => {
    const warning = checkDuplicateWarning('Guntur', '9876543210', existing, 1)
    expect(warning).toBeNull()
  })
})
