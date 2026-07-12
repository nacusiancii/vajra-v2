import { z } from 'zod'
import { isValidBagSizeG } from './units'

export { isNameTaken } from './utils'
export { isValidBagSizeG }

export const CreateProductSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    productGroupName: z.string().trim().min(1, 'Product Group is required'),
    type: z.enum(['packaged', 'bulk']),
    defaultBagSizeG: z.coerce.number().nullable(),
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
      if (d.type === 'bulk') return d.defaultBagSizeG != null && isValidBagSizeG(d.defaultBagSizeG)
      return d.defaultBagSizeG == null
    },
    {
      message: 'Bulk Products require a Default Bag Size; Packaged Products must not have one',
      path: ['defaultBagSizeG']
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
