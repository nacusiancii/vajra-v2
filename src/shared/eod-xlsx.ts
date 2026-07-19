/**
 * Pure End of Day Report builder — multi-sheet `.xlsx` via ExcelJS (ADR-0006).
 *
 * Inputs stay in domain units (money = integer paise; stock = grams). Cell values
 * shown to the shopkeeper are converted at the write boundary only:
 * - Money → rupees with numFmt `0.00`
 * - Stock → default-bag-equivalent units (same as formatStockQty / Rollover UI),
 *   with a header note on the Inventory sheet.
 *
 * Live Excel formulas (same-sheet only, cheap + stable):
 * - Summary: Cash net = Cash in − Cash out; UPI net = UPI in − UPI out
 * - Inventory Diff: Closing − Physical (Physical left empty for input)
 *
 * Everything else stays static from Vajra's projection library (summariseDrawer /
 * InventoryRow). No cross-sheet SUM from Transactions in this slice.
 */

import ExcelJS from 'exceljs'
import {
  displayTxnSerial,
  summariseDrawer,
  TXN_TYPE_LABELS,
  type BusinessDay,
  type InventoryRow,
  type Txn
} from '@domain/transaction'
import { paiseToRupees, stockGToDefaultBags } from '@domain/units'

/** Fixed sheet names — pinned by unit tests. */
export const EOD_SHEET_NAMES = ['Summary', 'Inventory', 'Transactions', 'Audit'] as const
export type EodSheetName = (typeof EOD_SHEET_NAMES)[number]

const MONEY_FMT = '0.00'
const QTY_FMT = '0.00'

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF5F5F5' }
}
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true }
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
  right: { style: 'thin', color: { argb: 'FFDDDDDD' } }
}

/**
 * Filename for a silent EOD export — `{yyyy-mm-dd_HH-mm-ss}_eod_report.xlsx`.
 * Uses **local wall clock of export**, not the Business Day startDate.
 */
export function eodReportFilename(now: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  const yyyy = now.getFullYear()
  const mm = pad(now.getMonth() + 1)
  const dd = pad(now.getDate())
  const HH = pad(now.getHours())
  const MM = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  return `${yyyy}-${mm}-${dd}_${HH}-${MM}-${ss}_eod_report.xlsx`
}

/** Safe basename pattern for main-process write (path segments rejected). */
export const EOD_REPORT_FILENAME_RE = /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_eod_report\.xlsx$/

/** MIME type for `.xlsx` downloads. */
export const EOD_XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Paise → rupees number for Excel (domain stays integer paise). */
function rupees(paise: number): number {
  return paiseToRupees(paise)
}

/**
 * Grams → default-bag-equivalent quantity (matches formatStockQty / cashier UI).
 * Documented on the Inventory sheet header row.
 */
function bagQty(qtyG: number, defaultBagSizeG: number): number {
  if (!defaultBagSizeG) return qtyG
  return stockGToDefaultBags(qtyG, defaultBagSizeG)
}

function counterparty(t: Txn): string {
  return t.customerName ?? t.walkinName ?? t.label ?? '—'
}

function modeLabel(t: Txn): string {
  if (t.saleMode === 'cash') return 'Cash'
  if (t.saleMode === 'credit') return 'Credit'
  return ''
}

function styleHeaderRow(row: ExcelJS.Row, colCount: number): void {
  row.font = HEADER_FONT
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c)
    cell.fill = HEADER_FILL
    cell.border = THIN_BORDER
  }
}

function applyLightBorders(row: ExcelJS.Row, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    row.getCell(c).border = THIN_BORDER
  }
}

function setColWidths(ws: ExcelJS.Worksheet, widths: number[]): void {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })
}

function moneyCell(cell: ExcelJS.Cell, paise: number): void {
  cell.value = rupees(paise)
  cell.numFmt = MONEY_FMT
  cell.alignment = { horizontal: 'right' }
}

function qtyCell(cell: ExcelJS.Cell, bags: number): void {
  cell.value = bags
  cell.numFmt = QTY_FMT
  cell.alignment = { horizontal: 'right' }
}

/**
 * Summary drawer layout (column B amounts). Row numbers are part of the formula
 * contract pinned by unit tests — do not renumber without updating tests + ADR.
 *
 *   6 Cash in (static)    7 Cash out (static)    8 Cash net (=B6-B7)
 *   9 UPI in (static)    10 UPI out (static)    11 UPI net (=B9-B10)
 *  12 Credit Sales (static)  13 Credit Purchases (static)
 */
const SUMMARY_HEADER_ROW = 5
const SUMMARY_CASH_IN_ROW = 6
const SUMMARY_CASH_OUT_ROW = 7
const SUMMARY_CASH_NET_ROW = 8
const SUMMARY_UPI_IN_ROW = 9
const SUMMARY_UPI_OUT_ROW = 10
const SUMMARY_UPI_NET_ROW = 11
const SUMMARY_CREDIT_SALES_ROW = 12
const SUMMARY_CREDIT_PURCHASES_ROW = 13

function buildSummarySheet(wb: ExcelJS.Workbook, day: BusinessDay, txns: Txn[]): void {
  const ws = wb.addWorksheet('Summary')
  const drawer = summariseDrawer(txns)

  ws.getCell('A1').value = 'Vajra — End of Day Report'
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.mergeCells('A1:B1')

  ws.getCell('A2').value = 'Business Day'
  ws.getCell('B2').value = day.startDate
  ws.getCell('A3').value = 'Generated'
  ws.getCell('B3').value =
    'For reconciliation — in/out and credit totals from Vajra; Cash net and UPI net are Excel formulas on this sheet.'

  ws.getCell(SUMMARY_HEADER_ROW, 1).value = 'Item'
  ws.getCell(SUMMARY_HEADER_ROW, 2).value = 'Amount (₹)'
  styleHeaderRow(ws.getRow(SUMMARY_HEADER_ROW), 2)

  const staticRows: [number, string, number][] = [
    [SUMMARY_CASH_IN_ROW, 'Cash in', drawer.cashIn],
    [SUMMARY_CASH_OUT_ROW, 'Cash out', drawer.cashOut],
    [SUMMARY_UPI_IN_ROW, 'UPI in', drawer.upiIn],
    [SUMMARY_UPI_OUT_ROW, 'UPI out', drawer.upiOut],
    [SUMMARY_CREDIT_SALES_ROW, 'Credit Sales', drawer.creditSales],
    [SUMMARY_CREDIT_PURCHASES_ROW, 'Credit Purchases', drawer.creditPurchases]
  ]
  for (const [r, label, paise] of staticRows) {
    ws.getCell(r, 1).value = label
    moneyCell(ws.getCell(r, 2), paise)
    applyLightBorders(ws.getRow(r), 2)
  }

  // Same-sheet nets — update when shopkeeper edits in/out cells in Excel.
  ws.getCell(SUMMARY_CASH_NET_ROW, 1).value = 'Cash net'
  const cashNetCell = ws.getCell(SUMMARY_CASH_NET_ROW, 2)
  cashNetCell.value = {
    formula: `B${SUMMARY_CASH_IN_ROW}-B${SUMMARY_CASH_OUT_ROW}`
  }
  cashNetCell.numFmt = MONEY_FMT
  cashNetCell.alignment = { horizontal: 'right' }
  applyLightBorders(ws.getRow(SUMMARY_CASH_NET_ROW), 2)

  ws.getCell(SUMMARY_UPI_NET_ROW, 1).value = 'UPI net'
  const upiNetCell = ws.getCell(SUMMARY_UPI_NET_ROW, 2)
  upiNetCell.value = {
    formula: `B${SUMMARY_UPI_IN_ROW}-B${SUMMARY_UPI_OUT_ROW}`
  }
  upiNetCell.numFmt = MONEY_FMT
  upiNetCell.alignment = { horizontal: 'right' }
  applyLightBorders(ws.getRow(SUMMARY_UPI_NET_ROW), 2)

  setColWidths(ws, [22, 16])
}

function buildInventorySheet(wb: ExcelJS.Workbook, inventory: InventoryRow[]): void {
  const ws = wb.addWorksheet('Inventory')
  // Row 1: unit note (not frozen as the only header — freeze includes data header at row 2)
  ws.getCell('A1').value =
    'Quantities are default-bag units (grams ÷ product Default Bag Size), same as the cashier Inventory view. Physical is blank for the shopkeeper to fill during reconciliation.'
  ws.getCell('A1').font = { italic: true, color: { argb: 'FF666666' }, size: 10 }
  ws.mergeCells('A1:I1')

  const headers = [
    'Group',
    'Product',
    'Opening',
    'Purchased',
    'Sold',
    'Transfer',
    'Closing',
    'Physical',
    'Diff'
  ]
  const headerRowIdx = 2
  const headerRow = ws.getRow(headerRowIdx)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  styleHeaderRow(headerRow, headers.length)
  ws.views = [{ state: 'frozen', ySplit: headerRowIdx }]

  inventory.forEach((row, i) => {
    const r = headerRowIdx + 1 + i
    const excelRow = ws.getRow(r)
    excelRow.getCell(1).value = row.productGroupName
    excelRow.getCell(2).value = row.productName
    qtyCell(excelRow.getCell(3), bagQty(row.opening, row.defaultBagSizeG))
    qtyCell(excelRow.getCell(4), bagQty(row.purchased, row.defaultBagSizeG))
    qtyCell(excelRow.getCell(5), bagQty(row.sold, row.defaultBagSizeG))
    qtyCell(excelRow.getCell(6), bagQty(row.transferIn - row.transferOut, row.defaultBagSizeG))
    qtyCell(excelRow.getCell(7), bagQty(row.closing, row.defaultBagSizeG))
    // Physical — empty for shopkeeper
    excelRow.getCell(8).value = null
    excelRow.getCell(8).numFmt = QTY_FMT
    excelRow.getCell(8).alignment = { horizontal: 'right' }
    // Diff = Closing − Physical (updates when Physical is filled)
    excelRow.getCell(9).value = { formula: `G${r}-H${r}` }
    excelRow.getCell(9).numFmt = QTY_FMT
    excelRow.getCell(9).alignment = { horizontal: 'right' }
    applyLightBorders(excelRow, headers.length)
  })

  setColWidths(ws, [16, 22, 12, 12, 12, 12, 12, 12, 12])
}

function buildTransactionsSheet(wb: ExcelJS.Workbook, txns: Txn[]): void {
  const ws = wb.addWorksheet('Transactions')
  const live = txns.filter((t) => !t.voided)

  const headers = [
    'No.',
    'Type',
    'Mode',
    'Counterparty',
    'Total (₹)',
    'Cash in',
    'UPI in',
    'Cash out',
    'UPI out',
    'Credit',
    'Discount',
    'Loading',
    'Remarks'
  ]
  const headerRow = ws.getRow(1)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  styleHeaderRow(headerRow, headers.length)
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  live.forEach((t, i) => {
    const r = i + 2
    const excelRow = ws.getRow(r)
    excelRow.getCell(1).value = displayTxnSerial(t)
    excelRow.getCell(2).value = TXN_TYPE_LABELS[t.type]
    excelRow.getCell(3).value = modeLabel(t)
    excelRow.getCell(4).value = counterparty(t)
    moneyCell(excelRow.getCell(5), t.total)
    moneyCell(excelRow.getCell(6), t.cashIn)
    moneyCell(excelRow.getCell(7), t.upiIn)
    moneyCell(excelRow.getCell(8), t.cashOut)
    moneyCell(excelRow.getCell(9), t.upiOut)
    moneyCell(excelRow.getCell(10), t.creditAmount)
    moneyCell(excelRow.getCell(11), t.discountAmount)
    moneyCell(excelRow.getCell(12), t.loadingCharges)
    excelRow.getCell(13).value = t.remarks ?? ''
    applyLightBorders(excelRow, headers.length)
  })

  setColWidths(ws, [10, 14, 10, 22, 12, 12, 12, 12, 12, 12, 12, 12, 24])
}

function buildAuditSheet(wb: ExcelJS.Workbook, txns: Txn[]): void {
  const ws = wb.addWorksheet('Audit')
  const voided = txns.filter((t) => t.voided)

  const headers = ['id', 'display serial/type', 'total', 'successorId']
  const headerRow = ws.getRow(1)
  headers.forEach((h, i) => {
    headerRow.getCell(i + 1).value = h
  })
  styleHeaderRow(headerRow, headers.length)
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  voided.forEach((t, i) => {
    const r = i + 2
    const excelRow = ws.getRow(r)
    excelRow.getCell(1).value = t.id
    excelRow.getCell(2).value = `${TXN_TYPE_LABELS[t.type]} #${displayTxnSerial(t)}`
    moneyCell(excelRow.getCell(3), t.total)
    excelRow.getCell(4).value = t.successorId ?? ''
    applyLightBorders(excelRow, headers.length)
  })

  setColWidths(ws, [28, 22, 12, 28])
}

/**
 * Build the End of Day Report workbook and return its binary bytes as a plain
 * ArrayBuffer (stable for Blob downloads and ExcelJS re-load in tests).
 * Pure: no DOM, no download side effects.
 */
export async function buildEodReportXlsx(
  day: BusinessDay,
  txns: Txn[],
  inventory: InventoryRow[]
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Vajra'
  wb.created = new Date()

  buildSummarySheet(wb, day, txns)
  buildInventorySheet(wb, inventory)
  buildTransactionsSheet(wb, txns)
  buildAuditSheet(wb, txns)

  const raw = await wb.xlsx.writeBuffer()
  // ExcelJS may return ArrayBuffer (browser) or Node Buffer; always copy to a
  // plain ArrayBuffer so BlobPart / load typings stay clean across targets.
  const src = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer)
  const copy = new ArrayBuffer(src.byteLength)
  new Uint8Array(copy).set(src)
  return copy
}
