import { ElectronAPI } from '@electron-toolkit/preload'
import type { VajraApi } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: VajraApi
  }
}
