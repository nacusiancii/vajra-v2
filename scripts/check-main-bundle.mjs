#!/usr/bin/env node
/**
 * Main must not `require('exceljs')`. That package pulls `util-deprecate` through
 * readable-stream; electron-builder 26.8.1 + pnpm 11 drops it from the Windows
 * asar, and the installed app crashes on launch (#187).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const main = readFileSync(join(root, 'out/main/index.js'), 'utf8')
const banned = main.match(/\brequire\((['"])exceljs\1\)/)
if (banned) {
  console.error(
    'check-main-bundle: out/main/index.js requires exceljs. Import filename helpers from src/shared/eod-filename.ts, not eod-xlsx.ts.'
  )
  process.exit(1)
}
