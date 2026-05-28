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
  listProductGroups: () => ipcRenderer.invoke(IPC.listProductGroups)
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
