/**
 * Typed IPC API surface.
 *
 * Every method the renderer can call lives here. The preload exposes this
 * shape; the main process implements it. Both sides import these types.
 */

import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
  Product,
  CreateProductInput,
  UpdateProductInput,
  Place,
  ProductGroup,
  DeleteCheck
} from '../domain/types'

export interface VajraApi {
  // ── Customers ──────────────────────────────────────────────
  listCustomers(): Promise<Customer[]>
  createCustomer(input: CreateCustomerInput): Promise<Customer>
  updateCustomer(id: number, input: UpdateCustomerInput): Promise<Customer>
  deleteCustomer(id: number): Promise<void>
  canDeleteCustomer(id: number): Promise<DeleteCheck>

  // ── Products ───────────────────────────────────────────────
  listProducts(): Promise<Product[]>
  createProduct(input: CreateProductInput): Promise<Product>
  updateProduct(id: number, input: UpdateProductInput): Promise<Product>
  deleteProduct(id: number): Promise<void>
  canDeleteProduct(id: number): Promise<DeleteCheck>

  // ── Lookup values (for combobox autocomplete) ──────────────
  listPlaces(): Promise<Place[]>
  listProductGroups(): Promise<ProductGroup[]>
}

/**
 * IPC channel names — one per API method.
 * Using a const object keeps channel strings in one place.
 */
export const IPC = {
  listCustomers: 'customer:list',
  createCustomer: 'customer:create',
  updateCustomer: 'customer:update',
  deleteCustomer: 'customer:delete',
  canDeleteCustomer: 'customer:canDelete',

  listProducts: 'product:list',
  createProduct: 'product:create',
  updateProduct: 'product:update',
  deleteProduct: 'product:delete',
  canDeleteProduct: 'product:canDelete',

  listPlaces: 'place:list',
  listProductGroups: 'productGroup:list'
} as const
