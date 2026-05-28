import { z } from 'zod'
import type { Customer } from './types'

export const CreateCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  placeName: z.string().trim().min(1, 'Place is required'),
  phone: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  nameTe: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  placeTe: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  remarks: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable()
})

export const UpdateCustomerSchema = CreateCustomerSchema

export type CreateCustomerParsed = z.infer<typeof CreateCustomerSchema>

/**
 * Case-insensitive check: does `name` collide with any existing customer?
 * Pass the id of the customer being edited to exclude it from the check.
 */
export function isNameTaken(
  name: string,
  existing: Array<{ id: number; name: string }>,
  excludeId?: number
): boolean {
  const lower = name.trim().toLowerCase()
  return existing.some((c) => c.id !== excludeId && c.name.toLowerCase() === lower)
}

export interface DuplicateWarning {
  matchingCustomers: Array<{ id: number; name: string }>
  reason: string
}

/**
 * Soft warning: same place AND same phone as an existing customer.
 * Only fires when phone is non-empty (null/empty phone can't match).
 */
export function checkDuplicateWarning(
  placeName: string,
  phone: string | null,
  existing: Customer[],
  excludeId?: number
): DuplicateWarning | null {
  if (!phone || phone.trim() === '') return null

  const matches = existing.filter(
    (c) =>
      c.id !== excludeId &&
      c.placeName.toLowerCase() === placeName.trim().toLowerCase() &&
      c.phone?.trim() === phone.trim()
  )

  if (matches.length === 0) return null

  return {
    matchingCustomers: matches.map((c) => ({ id: c.id, name: c.name })),
    reason: `Customer(s) with the same place and phone already exist: ${matches.map((c) => c.name).join(', ')}`
  }
}
