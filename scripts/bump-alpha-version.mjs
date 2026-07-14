#!/usr/bin/env node
/**
 * Bump package.json to the next alpha prerelease.
 *
 *   1.0.0          → 1.0.0-alpha.1
 *   1.0.0-alpha.1  → 1.0.0-alpha.2
 *   1.2.3-alpha.9  → 1.2.3-alpha.10
 *
 * Stable or non-alpha prereleases become `<base>-alpha.1`.
 * Prints the new version to stdout (and sets GITHUB_OUTPUT when present).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const packagePath = resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
const current = String(pkg.version ?? '')

const alphaMatch = current.match(/^(\d+\.\d+\.\d+)-alpha\.(\d+)$/)
let next
if (alphaMatch) {
  next = `${alphaMatch[1]}-alpha.${Number(alphaMatch[2]) + 1}`
} else {
  const baseMatch = current.match(/^(\d+\.\d+\.\d+)(?:[-+].*)?$/)
  if (!baseMatch) {
    console.error(`Cannot bump alpha from version: ${current || '(empty)'}`)
    process.exit(1)
  }
  next = `${baseMatch[1]}-alpha.1`
}

pkg.version = next
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

process.stdout.write(`${next}\n`)

if (process.env.GITHUB_OUTPUT) {
  writeFileSync(process.env.GITHUB_OUTPUT, `version=${next}\ntag=v${next}\n`, {
    flag: 'a'
  })
}
