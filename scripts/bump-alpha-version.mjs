#!/usr/bin/env node
/**
 * Next alpha version for package.json. Writes the file and prints the version.
 *
 *   1.0.0          → 1.0.0-alpha.1
 *   1.0.0-alpha.1  → 1.0.0-alpha.2
 *   1.2.3-beta.1   → 1.2.3-alpha.1   (non-alpha prereleases restart at .1)
 */
import { readFileSync, writeFileSync } from 'node:fs'

const path = 'package.json'
const pkg = JSON.parse(readFileSync(path, 'utf8'))
const current = String(pkg.version ?? '')

const match = current.match(/^(\d+\.\d+\.\d+)(?:-alpha\.(\d+)|(?:[-+].*)?)?$/)
if (!match) {
  console.error(`Cannot bump alpha from version: ${current || '(empty)'}`)
  process.exit(1)
}

const [, base, alphaN] = match
const next =
  alphaN != null ? `${base}-alpha.${Number(alphaN) + 1}` : `${base}-alpha.1`

pkg.version = next
writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
console.log(next)
