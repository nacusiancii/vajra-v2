/**
 * Silent End of Day Report write (main process).
 *
 * Default folder: ~/Documents/VajraExports. Override for tests/CI with
 * VAJRA_EOD_EXPORT_DIR. Creates the directory if missing. No save dialog.
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { EodExportResult } from '../shared/api'
import { EOD_REPORT_FILENAME_RE } from '../shared/eod-xlsx'

export type { EodExportResult }

/** Default export directory under the user's Documents folder. */
export function defaultEodExportDir(home: string = os.homedir()): string {
  return path.join(home, 'Documents', 'VajraExports')
}

/**
 * Resolve the export directory: env override first, else default under home.
 * `VAJRA_EOD_EXPORT_DIR` is absolute (or relative to cwd) for injectable tests.
 */
export function resolveEodExportDir(): string {
  const override = process.env.VAJRA_EOD_EXPORT_DIR?.trim()
  if (override) return path.resolve(override)
  return defaultEodExportDir()
}

/**
 * Write workbook bytes to the export folder.
 * @param bytes - XLSX file contents from the pure ExcelJS builder
 * @param filename - Basename only (`yyyy-mm-dd_HH-mm-ss_eod_report.xlsx`)
 * @param exportDir - Injectable directory (defaults to resolveEodExportDir)
 */
export function writeEodReportFile(
  bytes: Uint8Array,
  filename: string,
  exportDir: string = resolveEodExportDir()
): EodExportResult {
  if (!filename || path.basename(filename) !== filename) {
    return { ok: false, error: 'Invalid export filename' }
  }
  if (!EOD_REPORT_FILENAME_RE.test(filename)) {
    return { ok: false, error: 'Invalid export filename' }
  }
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return { ok: false, error: 'Empty report data' }
  }

  try {
    fs.mkdirSync(exportDir, { recursive: true })
    const fullPath = path.join(exportDir, filename)
    // Node fs accepts Uint8Array; writeFileSync overwrites same-second re-exports.
    fs.writeFileSync(fullPath, bytes)
    return { ok: true, path: fullPath }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not write export file'
    return { ok: false, error: message }
  }
}
