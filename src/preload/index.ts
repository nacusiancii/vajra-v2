import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC } from '../shared/api'
import type { VajraApi } from '../shared/api'

const api: VajraApi = {
  listCustomers: () => ipcRenderer.invoke(IPC.listCustomers),
  createCustomer: (input) => ipcRenderer.invoke(IPC.createCustomer, input),
  updateCustomer: (id, input) => ipcRenderer.invoke(IPC.updateCustomer, id, input),
  deleteCustomer: (id) => ipcRenderer.invoke(IPC.deleteCustomer, id),
  canDeleteCustomer: (id) => ipcRenderer.invoke(IPC.canDeleteCustomer, id),

  listProducts: () => ipcRenderer.invoke(IPC.listProducts),
  createProduct: (input) => ipcRenderer.invoke(IPC.createProduct, input),
  updateProduct: (id, input) => ipcRenderer.invoke(IPC.updateProduct, id, input),
  deleteProduct: (id) => ipcRenderer.invoke(IPC.deleteProduct, id),
  canDeleteProduct: (id) => ipcRenderer.invoke(IPC.canDeleteProduct, id),

  listPlaces: () => ipcRenderer.invoke(IPC.listPlaces),
  listProductGroups: () => ipcRenderer.invoke(IPC.listProductGroups),

  currentBusinessDay: () => ipcRenderer.invoke(IPC.currentBusinessDay),
  inventory: () => ipcRenderer.invoke(IPC.inventory),
  approveRollover: () => ipcRenderer.invoke(IPC.approveRollover),

  listTransactions: () => ipcRenderer.invoke(IPC.listTransactions),
  getTransaction: (id) => ipcRenderer.invoke(IPC.getTransaction, id),
  createSale: (input) => ipcRenderer.invoke(IPC.createSale, input),
  editSale: (id, input) => ipcRenderer.invoke(IPC.editSale, id, input),
  reserveCreditSaleSeq: () => ipcRenderer.invoke(IPC.reserveCreditSaleSeq),
  createPurchase: (input) => ipcRenderer.invoke(IPC.createPurchase, input),
  editPurchase: (id, input) => ipcRenderer.invoke(IPC.editPurchase, id, input),
  createStockTransfer: (input) => ipcRenderer.invoke(IPC.createStockTransfer, input),
  editStockTransfer: (id, input) => ipcRenderer.invoke(IPC.editStockTransfer, id, input),
  createMoneyTxn: (type, input) => ipcRenderer.invoke(IPC.createMoneyTxn, type, input),
  editMoneyTxn: (id, type, input) => ipcRenderer.invoke(IPC.editMoneyTxn, id, type, input),

  listDrafts: (type) => ipcRenderer.invoke(IPC.listDrafts, type),
  getDraft: (id) => ipcRenderer.invoke(IPC.getDraft, id),
  saveSaleDraft: (input) => ipcRenderer.invoke(IPC.saveSaleDraft, input),
  savePurchaseDraft: (input) => ipcRenderer.invoke(IPC.savePurchaseDraft, input),
  clearDraft: (id) => ipcRenderer.invoke(IPC.clearDraft, id),

  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (settings) => ipcRenderer.invoke(IPC.updateSettings, settings),

  exportEodReport: (input) => ipcRenderer.invoke(IPC.exportEodReport, input)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
