/**
 * Domain types for Vajra master data.
 *
 * These types use the glossary from CONTEXT.md exactly.
 * "Product type" = Packaged | Bulk.
 * "Default Bag Size" = the pack weight (grams) a bagged Bulk line uses;
 * Loose Lines carry raw kg with no bag size.
 */

import type { BagSizeG } from './units'
export type { BagSizeG } from './units'
export { BAG_SIZES_G, isValidBagSizeG } from './units'

export type ProductType = 'packaged' | 'bulk'

export interface Place {
  id: number
  name: string
}

export interface ProductGroup {
  id: number
  name: string
}

export interface Customer {
  id: number
  name: string
  placeId: number
  placeName: string
  phone: string | null
  nameTe: string | null
  placeTe: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: number
  name: string
  productGroupId: number
  productGroupName: string
  type: ProductType
  /** Default Bag Size in grams; null for Packaged. */
  defaultBagSizeG: BagSizeG | null
  nameTe: string | null
  remarks: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateCustomerInput {
  name: string
  placeName: string
  phone: string | null
  nameTe: string | null
  placeTe: string | null
  remarks: string | null
}

export type UpdateCustomerInput = CreateCustomerInput

export interface CreateProductInput {
  name: string
  productGroupName: string
  type: ProductType
  defaultBagSizeG: BagSizeG | null
  nameTe: string | null
  remarks: string | null
}

export interface UpdateProductInput {
  name: string
  productGroupName: string
  nameTe: string | null
  remarks: string | null
}

export interface DeleteCheck {
  canDelete: boolean
  reason?: string
}

/**
 * Interface for checking whether an entity has downstream references.
 * For this slice all entries are deletable — the implementation returns
 * { canDelete: true } unconditionally. Plug in real checks when Opening
 * Stock / transactions land.
 */
export interface ReferenceChecker {
  hasCustomerReferences(customerId: number): boolean
  hasProductReferences(productId: number): boolean
}

export const nullReferenceChecker: ReferenceChecker = {
  hasCustomerReferences: () => false,
  hasProductReferences: () => false
}
