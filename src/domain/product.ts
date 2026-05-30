import { z } from 'zod'
import { BAG_SIZES, type BagSizeKg } from './types'

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

export function isValidBagSize(kg: number): kg is BagSizeKg {
  return (BAG_SIZES as readonly number[]).includes(kg)
}
