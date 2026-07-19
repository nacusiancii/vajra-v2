/**
 * Browser download wrapper for the End of Day Report (ADR-0006).
 * Workbook construction lives in the pure builder `@shared/eod-xlsx`.
 */

import type { BusinessDay, InventoryRow, Txn } from '@domain/transaction'
import { buildEodReportXlsx, eodReportFilename, EOD_XLSX_MIME } from '@shared/eod-xlsx'

/** Save the report as a downloadable `.xlsx` (the shopkeeper picks the location). */
export async function downloadEodReport(
  day: BusinessDay,
  txns: Txn[],
  inventory: InventoryRow[]
): Promise<void> {
  const buffer = await buildEodReportXlsx(day, txns, inventory)
  const blob = new Blob([buffer], { type: EOD_XLSX_MIME })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = eodReportFilename(day.startDate)
  a.click()
  URL.revokeObjectURL(url)
}
