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
import type { Draft, DraftType, SavePurchaseDraftInput, SaveSaleDraftInput } from '../domain/draft'

export type MoneyTxnType = 'RE' | 'PA' | 'EX' | 'IN'

/** Payload for silent main-process EOD XLSX write. */
export interface ExportEodReportInput {
  /** Workbook bytes from `buildEodReportXlsx`. */
  data: ArrayBuffer
  /** Basename only — `yyyy-mm-dd_HH-mm-ss_eod_report.xlsx`. */
  filename: string
}

/** Result of writing the End of Day Report to disk (main process). */
export type EodExportResult = { ok: true; path: string } | { ok: false; error: string }

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
  /** Capture last_export_generation after a successful End of Day Report export. */
  recordEodExport(): Promise<BusinessDay>
  approveRollover(): Promise<BusinessDay>

  // ── Transactions ───────────────────────────────────────────
  listTransactions(): Promise<Txn[]>
  getTransaction(id: string): Promise<Txn | null>
  createSale(input: CreateSaleInput): Promise<Txn>
  editSale(id: string, input: CreateSaleInput): Promise<Txn>
  /**
   * Reserve the next Credit Sale sequence for a voucher print before finish.
   * Same sequence becomes the Sale's transaction ID (invoice + voucher share it).
   */
  reserveCreditSaleSeq(): Promise<number>
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
  savePurchaseDraft(input: SavePurchaseDraftInput): Promise<Draft>
  clearDraft(id: number): Promise<void>

  // ── Settings ───────────────────────────────────────────────
  getSettings(): Promise<AppSettings>
  updateSettings(settings: AppSettings): Promise<AppSettings>

  // ── End of Day Report (silent main-process write) ──────────
  /** Write a built `.xlsx` buffer under the export folder (no save dialog). */
  exportEodReport(input: ExportEodReportInput): Promise<EodExportResult>
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
  recordEodExport: 'eod:recordExport',
  approveRollover: 'rollover:approve',

  listTransactions: 'txn:list',
  getTransaction: 'txn:get',
  createSale: 'txn:createSale',
  editSale: 'txn:editSale',
  reserveCreditSaleSeq: 'txn:reserveCreditSaleSeq',
  createPurchase: 'txn:createPurchase',
  editPurchase: 'txn:editPurchase',
  createStockTransfer: 'txn:createStockTransfer',
  editStockTransfer: 'txn:editStockTransfer',
  createMoneyTxn: 'txn:createMoney',
  editMoneyTxn: 'txn:editMoney',

  listDrafts: 'draft:list',
  getDraft: 'draft:get',
  saveSaleDraft: 'draft:saveSale',
  savePurchaseDraft: 'draft:savePurchase',
  clearDraft: 'draft:clear',

  getSettings: 'settings:get',
  updateSettings: 'settings:update',

  exportEodReport: 'eod:exportReport'
} as const
