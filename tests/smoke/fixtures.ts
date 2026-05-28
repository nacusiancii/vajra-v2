import { test as base, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

/**
 * Electron test fixture that answers:
 * "What makes a good testing harness for an Electron app?"
 *
 * 1. Deterministic launch — always from the built output, not dev server.
 * 2. Isolated user data — each test gets a fresh temp directory wiped after.
 * 3. Linux sandbox env — handled here so test files stay clean.
 * 4. Cleanup — app and temp dir torn down by the fixture automatically.
 * 5. Public UI assertions — tests get `page` (first window), not internals.
 */

const electronBinary = require('electron') as unknown as string

type Fixtures = {
  electronApp: ElectronApplication
  page: Page
}

export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vajra-test-'))

    const app = await electron.launch({
      executablePath: electronBinary,
      args: [path.join(__dirname, '../../out/main/index.js')],
      env: {
        ...process.env,
        ELECTRON_DISABLE_SANDBOX: '1',
        VAJRA_USER_DATA: userDataDir
      }
    })

    await use(app)

    await app.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },

  page: async ({ electronApp }, use) => {
    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')
    await use(window)
  }
})

export { expect } from '@playwright/test'
