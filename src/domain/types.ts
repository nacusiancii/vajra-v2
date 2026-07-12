/**
 * Domain types for Vajra master data.
 *
 * These types use the glossary from CONTEXT.md exactly.
 * "Product type" = Packaged | Bulk.
 * "Default Bag Type" = a shop-configured pack weight in Settings (positive integer kg).
 * "Default Bag Size" = the Default Bag Type a Bulk Product's stock is measured against.
 */

export type ProductType = 'packaged' | 'bulk'

/**
 * Positive integer kg for a Default Bag Type / Default Bag Size / line bag weight.
 * Not a closed set — the shop's Settings catalog is the source of truth for which
 * sizes may be chosen as Product Default Bag Size.
 */
export type BagSizeKg = number

/** Seed Default Bag Types shipped with a fresh install (loading ₹0 each). */
export const SEED_BAG_SIZES: readonly BagSizeKg[] = [25, 30, 50] as const

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
  defaultBagSizeKg: BagSizeKg | null
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
  defaultBagSizeKg: BagSizeKg | null
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
