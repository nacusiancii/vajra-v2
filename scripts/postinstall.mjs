#!/usr/bin/env node
/**
 * Fetch the Electron binary. Skipped when SKIP_ELECTRON=1 (static/report CI).
 * better-sqlite3 13 loads N-API prebuilds — no install-app-deps rebuild.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

if (process.env.SKIP_ELECTRON === '1') {
  process.exit(0)
}

const require = createRequire(import.meta.url)
const installJs = require.resolve('electron/install.js')
const result = spawnSync(process.execPath, [installJs], { stdio: 'inherit' })
process.exit(result.status ?? 1)
