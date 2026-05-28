import { z } from 'zod'
import { BAG_SIZES, type BagSizeKg, type Product } from './types'

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    productGroupName: z.string().trim().min(1, 'Product Group is required'),
    type: z.enum(['packaged', 'bulk']),
    defaultBagSizeKg: z.coerce.number().nullable(),
    nameTe: z
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
  .refine(
    (d) => {
      if (d.type === 'bulk') return d.defaultBagSizeKg != null
      return d.defaultBagSizeKg == null
    },
    {
      message: 'Bulk Products require a Default Bag Size; Packaged Products must not have one',
      path: ['defaultBagSizeKg']
    }
  )

export const UpdateProductSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  productGroupName: z.string().trim().min(1, 'Product Group is required'),
  nameTe: z
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

export type CreateProductParsed = z.infer<typeof CreateProductSchema>

/**
 * Case-insensitive check: does `name` collide with any existing product?
 */
export function isNameTaken(
  name: string,
  existing: Array<{ id: number; name: string }>,
  excludeId?: number
): boolean {
  const lower = name.trim().toLowerCase()
  return existing.some((p) => p.id !== excludeId && p.name.toLowerCase() === lower)
}

/**
 * Guard: type and defaultBagSizeKg are immutable after creation.
 * Returns a list of violated fields, or empty array if safe.
 */
export function checkImmutableViolation(
  existing: Product,
  updates: { type?: string; defaultBagSizeKg?: number | null }
): string[] {
  const violations: string[] = []
  if (updates.type !== undefined && updates.type !== existing.type) {
    violations.push('type')
  }
  if (
    updates.defaultBagSizeKg !== undefined &&
    updates.defaultBagSizeKg !== existing.defaultBagSizeKg
  ) {
    violations.push('defaultBagSizeKg')
  }
  return violations
}

export function isValidBagSize(kg: number): kg is BagSizeKg {
  return (BAG_SIZES as readonly number[]).includes(kg)
}
