/**
 * Print to PDF (ADR-0012). Until the shop has its printer, "print" means: render
 * the window's print layout to a PDF, save it, and open it in the default viewer
 * so the shopkeeper can print or share it from there.
 *
 * Page size comes from the CSS `@page` rule (10 cm × 21 cm upright), so the
 * renderer owns the layout and this file only moves bytes.
 *
 * Folder: ~/Documents/VajraPrints, or VAJRA_PRINT_DIR for tests. Set
 * VAJRA_PRINT_NO_OPEN=1 to skip opening the viewer (smoke tests).
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { shell, type WebContents } from 'electron'
import type { SavePdfResult } from '../shared/api'

/** Basename made of ID-safe characters, ending in .pdf. */
const PDF_FILENAME_RE = /^[A-Za-z0-9._-]+\.pdf$/

export function resolvePrintDir(): string {
  const override = process.env.VAJRA_PRINT_DIR?.trim()
  if (override) return path.resolve(override)
  return path.join(os.homedir(), 'Documents', 'VajraPrints')
}

export async function savePdf(contents: WebContents, filename: string): Promise<SavePdfResult> {
  if (typeof filename !== 'string' || !PDF_FILENAME_RE.test(filename)) {
    return { ok: false, error: 'Invalid PDF filename' }
  }
  try {
    const bytes = await contents.printToPDF({
      preferCSSPageSize: true,
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    const dir = resolvePrintDir()
    fs.mkdirSync(dir, { recursive: true })
    const fullPath = path.join(dir, filename)
    fs.writeFileSync(fullPath, bytes)
    if (process.env.VAJRA_PRINT_NO_OPEN !== '1') {
      const openError = await shell.openPath(fullPath)
      // Saved but no viewer: still a success — the file is on disk.
      if (openError) console.warn(`Saved ${fullPath} but could not open it: ${openError}`)
    }
    return { ok: true, path: fullPath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save PDF' }
  }
}
