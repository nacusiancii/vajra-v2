import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  buildEodReportXlsx,
  eodReportFilename,
  EOD_SHEET_NAMES,
  type EodSheetName
} from '@shared/eod-xlsx'
import type { BusinessDay, InventoryRow, Txn, TxnLine } from '@domain/transaction'

function stubLine(partial: Partial<TxnLine> & Pick<TxnLine, 'id' | 'productName'>): TxnLine {
  return {
    productId: 1,
    side: 'single',
    isLoose: false,
    bagSizeG: 50_000,
    quintalRate: 1_000_000,
    perKgRate: null,
    qty: 1,
    stockDelta: -50_000,
    lineTotal: 50_000,
    ...partial
  }
}

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
  closedAt: null,
  ledgerGeneration: 0,
  lastExportGeneration: null
}

/**
 * Fixture day book: SA cash (goods + loading), SA credit (goods + discount), PU,
 * RE, PA, IN, EX, voided SA + voided RE.
 * Line Items: live SA/PU goods + synthetics; Money: live RE/PA/IN/EX only.
 */
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
    loadingApplied: true,
    discountAmount: 0,
    lines: [
      stubLine({
        id: 101,
        productName: 'Toor Dal Premium',
        qty: 1,
        bagSizeG: 50_000,
        quintalRate: 980_000,
        lineTotal: 49_000,
        stockDelta: -50_000
      })
    ]
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
    discountAmount: 500,
    lines: [
      stubLine({
        id: 201,
        productName: 'Moong Dal',
        productId: 2,
        qty: 2,
        bagSizeG: 50_000,
        quintalRate: 1_205_000,
        lineTotal: 120_500,
        stockDelta: -100_000
      })
    ]
  }),
  stubTxn({
    id: 'PU-C-1-23052026',
    type: 'PU',
    voided: false,
    seq: 1,
    saleMode: 'cash',
    customerName: 'Supplier Co',
    cashOut: 10_000,
    total: 10_000,
    lines: [
      stubLine({
        id: 301,
        productName: 'Toor Dal Premium',
        qty: 1,
        bagSizeG: 50_000,
        quintalRate: 200_000,
        lineTotal: 10_000,
        stockDelta: 50_000
      })
    ]
  }),
  stubTxn({
    id: 'RE-1-23052026',
    type: 'RE',
    voided: false,
    seq: 1,
    customerName: 'Ravi Traders',
    cashIn: 5_000,
    upiIn: 2_000,
    discountAmount: 100,
    total: 7_000,
    createdAt: '2026-05-23T10:15:00.000Z',
    remarks: 'partial settle'
  }),
  stubTxn({
    id: 'PA-1-23052026',
    type: 'PA',
    voided: false,
    seq: 1,
    customerName: 'Supplier Co',
    cashOut: 3_000,
    upiOut: 1_000,
    discountAmount: 50,
    total: 4_000,
    createdAt: '2026-05-23T11:00:00.000Z'
  }),
  stubTxn({
    id: 'IN-1-23052026',
    type: 'IN',
    voided: false,
    seq: 1,
    label: 'Commission',
    cashIn: 500,
    total: 500,
    createdAt: '2026-05-23T12:00:00.000Z'
  }),
  stubTxn({
    id: 'EX-1-23052026',
    type: 'EX',
    voided: false,
    seq: 1,
    label: 'Tea',
    cashOut: 200,
    total: 200,
    createdAt: '2026-05-23T13:00:00.000Z',
    remarks: 'staff tea'
  }),
  stubTxn({
    id: 'RE-2-23052026',
    type: 'RE',
    voided: true,
    seq: 2,
    customerName: 'Voided receipt party',
    cashIn: 88_000,
    total: 88_000,
    successorId: 'RE-2.1-23052026'
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
    successorId: 'SA-C-3.1-23052026',
    loadingCharges: 500,
    loadingApplied: true,
    lines: [stubLine({ id: 999, productName: 'Void product', lineTotal: 99_400 })]
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
  it('uses local wall-clock yyyy-mm-dd_HH-mm-ss_eod_report.xlsx', () => {
    // Fixed local components via Date ctor (year, monthIndex, day, h, m, s)
    const when = new Date(2026, 4, 23, 14, 7, 9) // 2026-05-23 14:07:09 local
    expect(eodReportFilename(when)).toBe('2026-05-23_14-07-09_eod_report.xlsx')
  })
})

describe('buildEodReportXlsx', () => {
  it('emits exactly the pinned sheet names including Line Items and Money', async () => {
    const wb = await loadWorkbook()
    const names = wb.worksheets.map((w) => w.name)
    expect(names).toEqual([...EOD_SHEET_NAMES])
    expect(names).toContain('Line Items')
    expect(names).toContain('Money')
  })

  it('Summary has static in/out and formula nets; credit sales (rupees)', async () => {
    const wb = await loadWorkbook()
    const ws = sheet(wb, 'Summary')
    expect(ws.getCell('B2').value).toBe('2026-05-23')
    // cashIn 50k+5k+0.5k=55_500 paise → 555; cashOut 10k+3k+0.2k=13_200 → 132
    expect(summaryAmount(ws, 'Cash in')).toBe(555)
    expect(summaryAmount(ws, 'Cash out')).toBe(132)
    // Cash net / UPI net are same-sheet formulas (row layout pinned)
    expect(cellFormula(summaryCellValue(ws, 'Cash net'))).toBe('B6-B7')
    expect(summaryAmount(ws, 'UPI in')).toBe(20) // 2_000 paise
    expect(summaryAmount(ws, 'UPI out')).toBe(10) // 1_000 paise (Payment)
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
    for (let r = 2; r <= (txnSheet.rowCount || 20); r++) {
      const v = txnSheet.getCell(r, 1).value
      if (v == null || v === '') break
      txnSerials.push(String(v))
    }
    // Live: SA C-1, SA R-2, PU C-1, RE 1, PA 1, IN 1, EX 1
    expect(txnSerials).toEqual(['C-1', 'R-2', 'C-1', '1', '1', '1', '1'])
    expect(txnSerials).not.toContain('C-3')

    // Audit: voided RE then voided SA (fixture order)
    expect(auditSheet.getCell(2, 1).value).toBe('RE-2-23052026')
    expect(auditSheet.getCell(2, 4).value).toBe('RE-2.1-23052026')
    expect(auditSheet.getCell(3, 1).value).toBe('SA-C-3-23052026')
    expect(String(auditSheet.getCell(3, 2).value)).toContain('C-3')
    expect(auditSheet.getCell(3, 3).value).toBe(999) // 99_900 paise
    expect(auditSheet.getCell(3, 4).value).toBe('SA-C-3.1-23052026')
  })

  it('Money sheet lists live RE/PA/IN/EX only — not sales or voided money', async () => {
    const wb = await loadWorkbook()
    const ws = sheet(wb, 'Money')

    // Headers pinned
    expect(ws.getCell(1, 1).value).toBe('Time')
    expect(ws.getCell(1, 2).value).toBe('No.')
    expect(ws.getCell(1, 3).value).toBe('Type')
    expect(ws.getCell(1, 4).value).toBe('Party')
    expect(ws.getCell(1, 9).value).toBe('Discount')
    expect(ws.getCell(1, 10).value).toBe('Total (₹)')
    expect(ws.getCell(1, 11).value).toBe('Remarks')

    const types: string[] = []
    const parties: string[] = []
    for (let r = 2; r <= (ws.rowCount || 20); r++) {
      const type = ws.getCell(r, 3).value
      if (type == null || type === '') break
      types.push(String(type))
      parties.push(String(ws.getCell(r, 4).value))
    }

    expect(types).toEqual(['Receipt', 'Payment', 'Income', 'Expense'])
    expect(parties).toEqual(['Ravi Traders', 'Supplier Co', 'Commission', 'Tea'])
    // Sales and Purchases must not appear
    expect(types).not.toContain('Sale')
    expect(types).not.toContain('Purchase')
    expect(parties).not.toContain('Walk-in buyer')
    expect(parties).not.toContain('Voided receipt party')

    // Receipt row: time, serial, cash/upi in, settlement discount, total, remarks
    expect(ws.getCell(2, 1).value).toBe('2026-05-23T10:15:00.000Z')
    expect(ws.getCell(2, 2).value).toBe('1')
    expect(ws.getCell(2, 5).value).toBe(50) // cashIn 5_000 paise
    expect(ws.getCell(2, 7).value).toBe(20) // upiIn 2_000
    expect(ws.getCell(2, 9).value).toBe(1) // discount 100 paise
    expect(ws.getCell(2, 10).value).toBe(70) // total 7_000
    expect(ws.getCell(2, 11).value).toBe('partial settle')

    // Payment: cash/upi out
    expect(ws.getCell(3, 3).value).toBe('Payment')
    expect(ws.getCell(3, 6).value).toBe(30) // cashOut 3_000
    expect(ws.getCell(3, 8).value).toBe(10) // upiOut 1_000
    expect(ws.getCell(3, 9).value).toBe(0.5) // discount 50 paise

    // Income / Expense labels as party
    expect(ws.getCell(4, 5).value).toBe(5) // Income cashIn 500
    expect(ws.getCell(5, 6).value).toBe(2) // Expense cashOut 200
    expect(ws.getCell(5, 11).value).toBe('staff tea')
  })

  it('returns a non-empty ArrayBuffer', async () => {
    const buf = await buildEodReportXlsx(day, txns, inventory)
    expect(buf).toBeInstanceOf(ArrayBuffer)
    expect(buf.byteLength).toBeGreaterThan(1000)
  })

  it('Line Items has goods + loading synthetic for a sale with loading; omits money-only', async () => {
    const wb = await loadWorkbook()
    const ws = sheet(wb, 'Line Items')

    // Headers: Time, Order Id, Line Id, Line Kind, Transaction Type, Party Name,
    // Product, Qty, Bag Size, Rate, Amt, Loading Charges, Total
    expect(ws.getCell(1, 4).value).toBe('Line Kind')
    expect(ws.getCell(1, 12).value).toBe('Loading Charges')

    type Row = {
      orderId: string
      lineId: string | number
      kind: string
      type: string
      product: string
      qty: number | null
      bagSize: number | string | null
      rate: number | null
      amt: number | null
      loading: number | null
      total: number | null
    }
    const rows: Row[] = []
    for (let r = 2; r <= (ws.rowCount || 20); r++) {
      const orderId = ws.getCell(r, 2).value
      if (orderId == null || orderId === '') break
      const qtyVal = ws.getCell(r, 8).value
      const bagVal = ws.getCell(r, 9).value
      const rateVal = ws.getCell(r, 10).value
      const amtVal = ws.getCell(r, 11).value
      const loadVal = ws.getCell(r, 12).value
      const totalVal = ws.getCell(r, 13).value
      rows.push({
        orderId: String(orderId),
        lineId: ws.getCell(r, 3).value as string | number,
        kind: String(ws.getCell(r, 4).value),
        type: String(ws.getCell(r, 5).value),
        product: String(ws.getCell(r, 7).value ?? ''),
        qty: typeof qtyVal === 'number' ? qtyVal : null,
        bagSize: typeof bagVal === 'number' || typeof bagVal === 'string' ? bagVal : null,
        rate: typeof rateVal === 'number' ? rateVal : null,
        amt: typeof amtVal === 'number' ? amtVal : null,
        loading: typeof loadVal === 'number' ? loadVal : null,
        total: typeof totalVal === 'number' ? totalVal : null
      })
    }

    // Cash sale: goods then one cart-level loading synthetic (not split onto goods).
    const saleGoods = rows.find(
      (r) => r.kind === 'goods' && r.type === 'Sale' && r.product === 'Toor Dal Premium'
    )
    expect(saleGoods).toBeDefined()
    expect(saleGoods!.lineId).toBe(101)
    expect(saleGoods!.qty).toBe(1)
    expect(saleGoods!.bagSize).toBe(50) // 50_000 g → 50 kg
    expect(saleGoods!.rate).toBe(9800) // 980_000 paise → ₹9800 quintal
    expect(saleGoods!.amt).toBe(490) // 49_000 paise
    expect(saleGoods!.loading).toBeNull()

    const loadingRow = rows.find((r) => r.kind === 'loading')
    expect(loadingRow).toBeDefined()
    expect(loadingRow!.type).toBe('Sale')
    expect(loadingRow!.product).toBe('Loading Charges')
    expect(loadingRow!.loading).toBe(10) // 1_000 paise → ₹10
    expect(loadingRow!.amt).toBeNull()
    // Order total on last row of that sale (loading is last)
    expect(loadingRow!.total).toBe(500) // 50_000 paise

    // Credit sale has discount synthetic
    const discountRow = rows.find((r) => r.kind === 'discount')
    expect(discountRow).toBeDefined()
    expect(discountRow!.product).toBe('Discount')
    expect(discountRow!.amt).toBe(5) // 500 paise

    // Only goods + synthetic kinds; no Receipt (money-only)
    expect(
      rows.every(
        (r) =>
          r.kind === 'goods' ||
          r.kind === 'loading' ||
          r.kind === 'discount' ||
          r.kind === 'additional'
      )
    ).toBe(true)
    expect(
      rows.every((r) => r.type === 'Sale' || r.type === 'Purchase' || r.type === 'Stock Transfer')
    ).toBe(true)

    // Voided sale lines excluded
    expect(rows.some((r) => r.product === 'Void product')).toBe(false)
    expect(rows.filter((r) => r.kind === 'loading')).toHaveLength(1)

    // Purchase goods present
    const puGoods = rows.find(
      (r) => r.kind === 'goods' && r.type === 'Purchase' && r.product === 'Toor Dal Premium'
    )
    expect(puGoods).toBeDefined()
    expect(puGoods!.amt).toBe(100)
  })
})
