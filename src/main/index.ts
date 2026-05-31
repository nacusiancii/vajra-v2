import { app, ipcMain, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/api'
import { registerIpcHandlers } from './ipc'
import { closeDb } from './db'

let mainWindow: BrowserWindow | null = null

/** Common web preferences for every Vajra window. */
const webPreferences = {
  preload: join(__dirname, '../preload/index.js'),
  sandbox: false
}

/**
 * Point a window at a renderer route. Transaction windows carry `?role=txn` so the
 * renderer can render its standalone (hub-less) chrome. Hash routing keeps the
 * query intact ahead of the `#`.
 */
function loadRoute(win: BrowserWindow, role: 'txn' | null, hashPath: string): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const search = role ? `?role=${role}` : ''
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${search}#${hashPath}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), {
      search: role ? `role=${role}` : undefined,
      hash: hashPath
    })
  }
}

/** Open one transaction screen in its own OS window (ADR-deferred: see branch notes). */
function createTransactionWindow(path: string): void {
  const win = new BrowserWindow({
    width: 820,
    height: 760,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences
  })

  win.on('ready-to-show', () => {
    win.show()
    win.focus()
  })

  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  loadRoute(win, 'txn', path)
}

function registerWindowHandlers(): void {
  ipcMain.handle(IPC.openTransactionWindow, (_e, path: string) => {
    createTransactionWindow(path)
  })
  ipcMain.handle(IPC.closeCurrentWindow, (e) => {
    BrowserWindow.fromWebContents(e.sender)?.close()
  })
}

function showMainWindow(): void {
  if (!mainWindow) return

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences
  })

  mainWindow.on('ready-to-show', () => {
    showMainWindow()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  void app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerIpcHandlers()
    registerWindowHandlers()

    createWindow()

    app.on('activate', function () {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  // Quit when all windows are closed, except on macOS. There, it's common
  // for applications and their menu bar to stay active until the user quits
  // explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    closeDb()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
