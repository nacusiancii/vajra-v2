import { z } from 'zod'
import { isValidBagSizeG } from './units'

export { isNameTaken } from './utils'
export { isValidBagSizeG }

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    productGroupName: z.string().trim().min(1, 'Product Group is required'),
    defaultBagSizeG: z.coerce.number(),
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
  .refine((d) => isValidBagSizeG(d.defaultBagSizeG), {
    message: 'Products require a Default Bag Size (25, 30, or 50 kg)',
    path: ['defaultBagSizeG']
  })

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

/** Presentation sort inside a Product Group. Nulls last, then name. Not a stock formula. */
export function compareInventoryProductOrder(
  a: { inventoryOrder: number | null; name: string },
  b: { inventoryOrder: number | null; name: string }
): number {
  const aSet = a.inventoryOrder != null
  const bSet = b.inventoryOrder != null
  if (aSet && bSet && a.inventoryOrder !== b.inventoryOrder) {
    return a.inventoryOrder! - b.inventoryOrder!
  }
  if (aSet !== bSet) return aSet ? -1 : 1
  return a.name.localeCompare(b.name)
}
