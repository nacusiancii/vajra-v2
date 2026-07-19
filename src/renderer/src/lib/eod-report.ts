/**
 * End of Day Report export (ADR-0006).
 * Builds the multi-sheet workbook in the renderer, then asks the main process
 * to write it under the silent export folder (no save dialog).
 * On success, records the export watermark so Approve Rollover may unlock.
 */

import type { BusinessDay, InventoryRow, Txn } from '@domain/transaction'
import type { EodExportResult } from '@shared/api'
import { buildEodReportXlsx, eodReportFilename } from '@shared/eod-xlsx'

/**
 * Build the EOD XLSX and write it via Electron main to the fixed export folder.
 * Returns the absolute path on success, or a short error reason on failure.
 * Successful writes also capture last_export_generation for the approve gate.
 */
export async function exportEodReport(
  day: BusinessDay,
  txns: Txn[],
  inventory: InventoryRow[],
  now: Date = new Date()
): Promise<EodExportResult> {
  try {
    const buffer = await buildEodReportXlsx(day, txns, inventory)
    const filename = eodReportFilename(now)
    const result = await window.api.exportEodReport({ data: buffer, filename })
    if (result.ok) {
      await window.api.recordEodExport()
    }
    return result
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not build export'
    return { ok: false, error: message }
  }
}
