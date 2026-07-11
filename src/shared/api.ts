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
import type {
  BusinessDay,
  CreateMoneyTxnInput,
  CreatePurchaseInput,
  CreateSaleInput,
  CreateStockTransferInput,
  InventoryRow,
  Txn
} from '../domain/transaction'
import type { AppSettings } from '../domain/settings'
import type { Draft, DraftType, SaveSaleDraftInput } from '../domain/draft'

export type MoneyTxnType = 'RE' | 'PA' | 'EX' | 'IN'

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

  // ── Business Day, Inventory, Rollover ──────────────────────
  currentBusinessDay(): Promise<BusinessDay>
  inventory(): Promise<InventoryRow[]>
  approveRollover(): Promise<BusinessDay>

  // ── Transactions ───────────────────────────────────────────
  listTransactions(): Promise<Txn[]>
  getTransaction(id: string): Promise<Txn | null>
  createSale(input: CreateSaleInput): Promise<Txn>
  editSale(id: string, input: CreateSaleInput): Promise<Txn>
  /** Mint the next Credit Voucher number for the open day (one per voucher print). */
  reserveVoucherSeq(): Promise<number>
  createPurchase(input: CreatePurchaseInput): Promise<Txn>
  editPurchase(id: string, input: CreatePurchaseInput): Promise<Txn>
  createStockTransfer(input: CreateStockTransferInput): Promise<Txn>
  editStockTransfer(id: string, input: CreateStockTransferInput): Promise<Txn>
  createMoneyTxn(type: MoneyTxnType, input: CreateMoneyTxnInput): Promise<Txn>
  editMoneyTxn(id: string, type: MoneyTxnType, input: CreateMoneyTxnInput): Promise<Txn>

  // ── Drafts (ADR-0010 — outside the ledger) ─────────────────
  /** List Drafts for the open Business Day; optional type filter (SA / PU). */
  listDrafts(type?: DraftType): Promise<Draft[]>
  getDraft(id: number): Promise<Draft | null>
  saveSaleDraft(input: SaveSaleDraftInput): Promise<Draft>
  clearDraft(id: number): Promise<void>

  // ── Settings ───────────────────────────────────────────────
  getSettings(): Promise<AppSettings>
  updateSettings(settings: AppSettings): Promise<AppSettings>
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
  listProductGroups: 'productGroup:list',

  currentBusinessDay: 'businessDay:current',
  inventory: 'inventory:get',
  approveRollover: 'rollover:approve',

  listTransactions: 'txn:list',
  getTransaction: 'txn:get',
  createSale: 'txn:createSale',
  editSale: 'txn:editSale',
  reserveVoucherSeq: 'txn:reserveVoucherSeq',
  createPurchase: 'txn:createPurchase',
  editPurchase: 'txn:editPurchase',
  createStockTransfer: 'txn:createStockTransfer',
  editStockTransfer: 'txn:editStockTransfer',
  createMoneyTxn: 'txn:createMoney',
  editMoneyTxn: 'txn:editMoney',

  listDrafts: 'draft:list',
  getDraft: 'draft:get',
  saveSaleDraft: 'draft:saveSale',
  clearDraft: 'draft:clear',

  getSettings: 'settings:get',
  updateSettings: 'settings:update'
} as const
