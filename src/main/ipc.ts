import { ipcMain } from 'electron'
import { IPC } from '../shared/api'
import { getDb } from './db'
import { CustomerRepo } from './repositories/customer-repo'
import { ProductRepo } from './repositories/product-repo'

export function registerIpcHandlers(): void {
  const db = getDb()
  const customers = new CustomerRepo(db)
  const products = new ProductRepo(db)

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
}
