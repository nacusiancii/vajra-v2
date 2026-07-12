/**
 * Domain types for Vajra master data.
 *
 * These types use the glossary from CONTEXT.md exactly.
 * Every Product is a Bulk Product with a Default Bag Size.
 * "Bag Type" = a standard pack weight (stored as grams; 25/30/50 kg in v2).
 * "Default Bag Size" = the Bag Type a Product's stock is measured against.
 */

import type { BagSizeG } from './units'
export type { BagSizeG } from './units'
export { BAG_SIZES_G, isValidBagSizeG } from './units'

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
  /** Default Bag Size in grams — always set. */
  defaultBagSizeG: BagSizeG
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
  defaultBagSizeG: BagSizeG
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
