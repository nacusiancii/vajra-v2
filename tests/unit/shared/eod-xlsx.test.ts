import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  buildEodReportXlsx,
  eodReportFilename,
  EOD_SHEET_NAMES,
  type EodSheetName
} from '@shared/eod-xlsx'
import type { BusinessDay, InventoryRow, Txn } from '@domain/transaction'

function stubTxn(partial: Partial<Txn> & Pick<Txn, 'type' | 'voided' | 'id'>): Txn {
  return {
    seq: 1,
    rev: 0,
    saleMode: null,
    customerId: null,
    customerName: null,
    walkinName: null,
    walkinPlace: null,
    walkinPhone: null,
    label: null,
    cashIn: 0,
    upiIn: 0,
    cashOut: 0,
    upiOut: 0,
    additionalCharges: 0,
    loadingCharges: 0,
    loadingApplied: false,
    total: 0,
    creditAmount: 0,
    discountAmount: 0,
    remarks: null,
    successorId: null,
    createdAt: '2026-05-23T10:00:00.000Z',
    lines: [],
    ...partial
  }
}

const day: BusinessDay = {
  id: 1,
  startDate: '2026-05-23',
  status: 'open',
  openedAt: '2026-05-23T06:00:00.000Z',
  closedAt: null
}

/** Fixture: SA cash, SA credit, PU, RE, voided SA with successor. */
const txns: Txn[] = [
  stubTxn({
    id: 'SA-C-1-23052026',
    type: 'SA',
    voided: false,
    seq: 1,
    saleMode: 'cash',
    customerName: 'Walk-in buyer',
    cashIn: 50_000,
    total: 50_000,
    loadingCharges: 1_000,
    discountAmount: 0
  }),
  stubTxn({
    id: 'SA-R-2-23052026',
    type: 'SA',
    voided: false,
    seq: 2,
    saleMode: 'credit',
    customerName: 'Ravi Traders',
    creditAmount: 120_000,
    total: 120_000,
    discountAmount: 500
  }),
  stubTxn({
    id: 'PU-C-1-23052026',
    type: 'PU',
    voided: false,
    seq: 1,
    saleMode: 'cash',
    customerName: 'Supplier Co',
    cashOut: 10_000,
    total: 10_000
  }),
  stubTxn({
    id: 'RE-1-23052026',
    type: 'RE',
    voided: false,
    seq: 1,
    customerName: 'Ravi Traders',
    cashIn: 5_000,
    upiIn: 2_000,
    total: 7_000
  }),
  stubTxn({
    id: 'SA-C-3-23052026',
    type: 'SA',
    voided: true,
    seq: 3,
    saleMode: 'cash',
    customerName: 'Voided party',
    cashIn: 999_999,
    creditAmount: 999_999,
    total: 99_900,
    successorId: 'SA-C-3.1-23052026'
  })
]

const inventory: InventoryRow[] = [
  {
    productId: 1,
    productName: 'Toor Dal Premium',
    productGroupName: 'Toor Dal',
    defaultBagSizeG: 50_000,
    opening: 500_000,
    purchased: 250_000,
    sold: 100_000,
    transferIn: 0,
    transferOut: 50_000,
    closing: 600_000,
    negative: false
  }
]

async function loadWorkbook(): Promise<ExcelJS.Workbook> {
  const buf = await buildEodReportXlsx(day, txns, inventory)
  const wb = new ExcelJS.Workbook()
  // ExcelJS typings declare a Buffer that extends ArrayBuffer — cast is safe.
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer)
  return wb
}

function sheet(wb: ExcelJS.Workbook, name: EodSheetName): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(name)
  expect(ws, `sheet ${name}`).toBeDefined()
  return ws!
}

/** Find a label in column A and return column B's raw cell value on that row. */
function summaryCellValue(ws: ExcelJS.Worksheet, label: string): ExcelJS.CellValue {
  for (let r = 1; r <= (ws.rowCount || 20); r++) {
    if (ws.getCell(r, 1).value === label) {
      return ws.getCell(r, 2).value
    }
  }
  throw new Error(`Summary label not found: ${label}`)
}

/** Find a label in column A and return the numeric value of column B on that row. */
function summaryAmount(ws: ExcelJS.Worksheet, label: string): number {
  const v = summaryCellValue(ws, label)
  expect(typeof v).toBe('number')
  return v as number
}

/** ExcelJS may return formula as string or `{ formula }` after round-trip. */
function cellFormula(value: ExcelJS.CellValue): string {
  if (value != null && typeof value === 'object' && 'formula' in value) {
    return String((value as { formula: string }).formula)
  }
  throw new Error(`Expected formula cell, got: ${JSON.stringify(value)}`)
}

describe('eodReportFilename', () => {
  it('uses vajra-eod-YYYY-MM-DD.xlsx', () => {
    expect(eodReportFilename('2026-05-23')).toBe('vajra-eod-2026-05-23.xlsx')
  })
})

describe('buildEodReportXlsx', () => {
  it('emits exactly the four pinned sheet names', async () => {
    const wb = await loadWorkbook()
    const names = wb.worksheets.map((w) => w.name)
    expect(names).toEqual([...EOD_SHEET_NAMES])
  })

  it('Summary has static in/out and formula nets; credit sales (rupees)', async () => {
    const wb = await loadWorkbook()
    const ws = sheet(wb, 'Summary')
    expect(ws.getCell('B2').value).toBe('2026-05-23')
    // cashIn 50k+5k=55_000 paise → 550; cashOut 10_000 → 100
    expect(summaryAmount(ws, 'Cash in')).toBe(550)
    expect(summaryAmount(ws, 'Cash out')).toBe(100)
    // Cash net / UPI net are same-sheet formulas (row layout pinned)
    expect(cellFormula(summaryCellValue(ws, 'Cash net'))).toBe('B6-B7')
    expect(summaryAmount(ws, 'UPI in')).toBe(20) // 2_000 paise
    expect(summaryAmount(ws, 'UPI out')).toBe(0)
    expect(cellFormula(summaryCellValue(ws, 'UPI net'))).toBe('B9-B10')
    // credit sale 120_000 paise → 1200
    expect(summaryAmount(ws, 'Credit Sales')).toBe(1200)
    expect(summaryAmount(ws, 'Credit Purchases')).toBe(0)
  })

  it('Inventory has empty Physical and Diff formula per product row', async () => {
    const wb = await loadWorkbook()
    const ws = sheet(wb, 'Inventory')
    // data starts at row 3 (row 1 note, row 2 headers)
    expect(ws.getCell(3, 1).value).toBe('Toor Dal')
    expect(ws.getCell(3, 2).value).toBe('Toor Dal Premium')
    // opening 500_000 g / 50_000 = 10 bags
    expect(ws.getCell(3, 3).value).toBe(10)
    // Closing static (600_000 g / 50_000 = 12 bags) — not re-derived from Transactions
    expect(ws.getCell(3, 7).value).toBe(12)
    // Physical empty for shopkeeper input
    expect(ws.getCell(3, 8).value).toBeNull()
    // Diff formula Closing − Physical (ExcelJS formula shape)
    expect(cellFormula(ws.getCell(3, 9).value)).toBe('G3-H3')
  })

  it('Transactions excludes voided; Audit includes voided with successor', async () => {
    const wb = await loadWorkbook()
    const txnSheet = sheet(wb, 'Transactions')
    const auditSheet = sheet(wb, 'Audit')

    const txnSerials: string[] = []
    for (let r = 2; r <= (txnSheet.rowCount || 10); r++) {
      const v = txnSheet.getCell(r, 1).value
      if (v == null || v === '') break
      txnSerials.push(String(v))
    }
    expect(txnSerials).toEqual(['C-1', 'R-2', 'C-1', '1'])
    expect(txnSerials).not.toContain('C-3')

    // Audit row 2
    expect(auditSheet.getCell(2, 1).value).toBe('SA-C-3-23052026')
    expect(String(auditSheet.getCell(2, 2).value)).toContain('C-3')
    expect(auditSheet.getCell(2, 3).value).toBe(999) // 99_900 paise
    expect(auditSheet.getCell(2, 4).value).toBe('SA-C-3.1-23052026')
  })

  it('returns a non-empty ArrayBuffer', async () => {
    const buf = await buildEodReportXlsx(day, txns, inventory)
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect(buf.byteLength).toBeGreaterThan(1000)
  })
})
