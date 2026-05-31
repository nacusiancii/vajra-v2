import { ipcMain } from 'electron'
import { IPC } from '../shared/api'
import { getDb } from './db'
import { CustomerRepo } from './repositories/customer-repo'
import { ProductRepo } from './repositories/product-repo'
import { TransactionRepo } from './repositories/transaction-repo'
import { BusinessDayRepo } from './repositories/business-day-repo'
import { SettingsRepo } from './repositories/settings-repo'

export function registerIpcHandlers(): void {
  const db = getDb()
  const customers = new CustomerRepo(db, {
    hasCustomerReferences: (id) => customerHasReferences(db, id),
    hasProductReferences: () => false
  })
  const products = new ProductRepo(db, {
    hasCustomerReferences: () => false,
    hasProductReferences: (id) => productHasReferences(db, id)
  })
  const transactions = new TransactionRepo(db)
  const businessDay = new BusinessDayRepo(db)
  const settings = new SettingsRepo(db)

  // ── Customers ──────────────────────────────────────────────
  ipcMain.handle(IPC.listCustomers, () => customers.list())
  ipcMain.handle(IPC.createCustomer, (_e, input) => customers.create(input))
  ipcMain.handle(IPC.updateCustomer, (_e, id, input) => customers.update(id, input))
  ipcMain.handle(IPC.deleteCustomer, (_e, id) => customers.delete(id))
  ipcMain.handle(IPC.canDeleteCustomer, (_e, id) => customers.canDelete(id))

  // ── Products ───────────────────────────────────────────────
  ipcMain.handle(IPC.listProducts, () => products.list())
  ipcMain.handle(IPC.createProduct, (_e, input) => products.create(input))
  ipcMain.handle(IPC.updateProduct, (_e, id, input) => products.update(id, input))
  ipcMain.handle(IPC.deleteProduct, (_e, id) => products.delete(id))
  ipcMain.handle(IPC.canDeleteProduct, (_e, id) => products.canDelete(id))

  // ── Lookups ────────────────────────────────────────────────
  ipcMain.handle(IPC.listPlaces, () => customers.listPlaces())
  ipcMain.handle(IPC.listProductGroups, () => products.listProductGroups())

  // ── Business Day, Inventory, Rollover ──────────────────────
  ipcMain.handle(IPC.currentBusinessDay, () => businessDay.current())
  ipcMain.handle(IPC.inventory, () => businessDay.inventory())
  ipcMain.handle(IPC.approveRollover, () => businessDay.approveRollover())

  // ── Transactions ───────────────────────────────────────────
  ipcMain.handle(IPC.listTransactions, () => transactions.list())
  ipcMain.handle(IPC.getTransaction, (_e, id) => transactions.getById(id) ?? null)
  ipcMain.handle(IPC.createSale, (_e, input) => transactions.createSale(input))
  ipcMain.handle(IPC.editSale, (_e, id, input) => transactions.editSale(id, input))
  ipcMain.handle(IPC.createPurchase, (_e, input) => transactions.createPurchase(input))
  ipcMain.handle(IPC.editPurchase, (_e, id, input) => transactions.editPurchase(id, input))
  ipcMain.handle(IPC.createStockTransfer, (_e, input) => transactions.createStockTransfer(input))
  ipcMain.handle(IPC.editStockTransfer, (_e, id, input) =>
    transactions.editStockTransfer(id, input)
  )
  ipcMain.handle(IPC.createMoneyTxn, (_e, type, input) => transactions.createMoneyTxn(type, input))
  ipcMain.handle(IPC.editMoneyTxn, (_e, id, type, input) =>
    transactions.editMoneyTxn(id, type, input)
  )

  // ── Settings ───────────────────────────────────────────────
  ipcMain.handle(IPC.getSettings, () => settings.get())
  ipcMain.handle(IPC.updateSettings, (_e, next) => settings.update(next))
}

/** A Customer is referenced once any non-voided transaction points at it. */
function customerHasReferences(db: ReturnType<typeof getDb>, id: number): boolean {
  const row = db.prepare(`SELECT 1 FROM txn WHERE customer_id = ? AND voided = 0 LIMIT 1`).get(id)
  return row !== undefined
}

/** A Product is referenced once any non-voided transaction line points at it. */
function productHasReferences(db: ReturnType<typeof getDb>, id: number): boolean {
  const row = db
    .prepare(
      `SELECT 1 FROM txn_line l JOIN txn t ON t.id = l.txn_id
       WHERE l.product_id = ? AND t.voided = 0 LIMIT 1`
    )
    .get(id)
  return row !== undefined
}
