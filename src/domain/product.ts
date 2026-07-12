import { z } from 'zod'
import { isInDefaultBagTypeCatalog, isPositiveIntegerKg } from './settings'
import type { BagSizeKg } from './types'

export { isNameTaken } from './utils'

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
  .refine(
    (d) => {
      if (d.type !== 'bulk' || d.defaultBagSizeKg == null) return true
      return isPositiveIntegerKg(d.defaultBagSizeKg)
    },
    {
      message: 'Default Bag Size must be a positive integer kg',
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
 * Shape check for a bag weight: positive integer kg.
 * Catalog membership for Product Default Bag Size is separate — use
 * {@link isDefaultBagSizeInCatalog}.
 */
export function isValidBagSize(kg: number): kg is BagSizeKg {
  return isPositiveIntegerKg(kg)
}

/**
 * Product Default Bag Size must be a current Default Bag Type from Settings.
 */
export function isDefaultBagSizeInCatalog(
  kg: number | null | undefined,
  catalog: readonly number[]
): boolean {
  return kg != null && isInDefaultBagTypeCatalog(kg, catalog)
}

/**
 * Domain rule for bulk create: Default Bag Size ∈ current Default Bag Types.
 * Returns an error message or null when ok.
 */
export function validateBulkDefaultBagSize(
  type: 'packaged' | 'bulk',
  defaultBagSizeKg: number | null,
  catalog: readonly number[]
): string | null {
  if (type === 'packaged') {
    return defaultBagSizeKg == null ? null : 'Packaged Products must not have a Default Bag Size'
  }
  if (defaultBagSizeKg == null) {
    return 'Bulk Products require a Default Bag Size'
  }
  if (!isPositiveIntegerKg(defaultBagSizeKg)) {
    return 'Default Bag Size must be a positive integer kg'
  }
  if (!isInDefaultBagTypeCatalog(defaultBagSizeKg, catalog)) {
    return `Default Bag Size ${defaultBagSizeKg} kg is not in the Default Bag Types catalog`
  }
  return null
}
