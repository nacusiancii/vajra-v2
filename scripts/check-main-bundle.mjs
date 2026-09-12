#!/usr/bin/env node
/**
 * Main/preload may only `require()` Node builtins, `electron`, or packages in
 * package.json `dependencies`. Anything else is either a bundling miss (it will
 * not be in the asar) or a renderer lib accidentally pulled into the Node side.
 *
 * electron-builder 26.8.1 + pnpm 11 silently drops nested deps such as
 * util-deprecate; that crashed the Windows installer on launch (#187).
 */
import { builtinModules } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const allowed = new Set([
  'electron',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
  ...Object.keys(pkg.dependencies ?? {})
])

const requireRe = /\brequire\((['"])([^'"]+)\1\)/g

let failed = false
for (const rel of ['out/main/index.js', 'out/preload/index.js']) {
  const src = readFileSync(join(root, rel), 'utf8')
  requireRe.lastIndex = 0
  let match
  while ((match = requireRe.exec(src))) {
    const specifier = match[2]
    if (specifier.startsWith('.') || specifier.startsWith('/')) continue
    const name = specifier.startsWith('@')
      ? specifier.split('/').slice(0, 2).join('/')
      : specifier.split('/')[0]
    if (allowed.has(specifier) || allowed.has(name)) continue
    console.error(
      `check-main-bundle: ${rel} requires '${specifier}' which is not a runtime dependency`
    )
    failed = true
  }
}

if (failed) process.exit(1)
