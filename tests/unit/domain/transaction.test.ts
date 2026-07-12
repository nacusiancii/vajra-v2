import { describe, it, expect } from 'vitest'
import {
  dateToDDMMYYYY,
  formatTxnId,
  lineStockDelta,
  projectInventory,
  summariseDrawer,
  type ProjectionMovement,
  type ProjectionProduct,
  type Txn
} from '@domain/transaction'

describe('formatTxnId', () => {
  it('builds TT-NNNN-DDMMYYYY with zero-padded seq', () => {
    expect(formatTxnId('SA', 42, '2026-05-31')).toBe('SA-0042-31052026')
    expect(formatTxnId('ST', 1, '2026-01-09')).toBe('ST-0001-09012026')
  })

  it('dateToDDMMYYYY reorders the parts', () => {
    expect(dateToDDMMYYYY('2026-05-31')).toBe('31052026')
  })
})

describe('lineStockDelta (grams)', () => {
  it('bag default bag is mass of bags', () => {
    // 2 × 50kg = 100_000 g
    expect(
      lineStockDelta({
        isLoose: false,
        qty: 2,
        bagSizeG: 50_000,
        direction: 1
      })
    ).toBe(100_000)
  })

  it('bag non-default bag moves mass of that bag type', () => {
    expect(
      lineStockDelta({
        isLoose: false,
        qty: 1,
        bagSizeG: 25_000,
        direction: -1
      })
    ).toBe(-25_000)
  })

  it('30kg bag × 5 is exact grams', () => {
    expect(
      lineStockDelta({
        isLoose: false,
        qty: 5,
        bagSizeG: 30_000,
        direction: -1
      })
    ).toBe(-150_000)
  })

  it('loose qty kg becomes grams', () => {
    expect(
      lineStockDelta({
        isLoose: true,
        qty: 2.5,
        bagSizeG: null,
        direction: -1
      })
    ).toBe(-2_500)
    expect(
      lineStockDelta({
        isLoose: true,
        qty: 12,
        bagSizeG: null,
        direction: 1
      })
    ).toBe(12_000)
  })

  it('missing bag sizes falls back to raw qty (edge / incomplete line)', () => {
    expect(
      lineStockDelta({
        isLoose: false,
        qty: 3,
        bagSizeG: null,
        direction: -1
      })
    ).toBe(-3)
  })
})

describe('projectInventory', () => {
  const products: ProjectionProduct[] = [
    { id: 1, name: 'Toor Dal', productGroupName: 'Dal', defaultBagSizeG: 50_000 },
    { id: 2, name: 'Moong', productGroupName: 'Dal', defaultBagSizeG: 50_000 }
  ]

  it('opening + purchased - sold + transfers = closing (grams)', () => {
    // 10 bags of 50kg = 500_000 g opening
    const opening = new Map<number, number>([
      [1, 500_000],
      [2, 100_000]
    ])
    const movements: ProjectionMovement[] = [
      { productId: 1, type: 'PU', stockDelta: 250_000 }, // +5 bags
      { productId: 1, type: 'SA', stockDelta: -100_000 }, // -2 bags
      { productId: 1, type: 'ST', stockDelta: -50_000 }, // -1 bag
      { productId: 2, type: 'SA', stockDelta: -2_500 } // loose 2.5 kg
    ]
    const rows = projectInventory(products, opening, movements)
    const dal = rows.find((r) => r.productId === 1)!
    expect(dal.opening).toBe(500_000)
    expect(dal.purchased).toBe(250_000)
    expect(dal.sold).toBe(100_000)
    expect(dal.transferOut).toBe(50_000)
    expect(dal.closing).toBe(600_000) // 500+250-100-50
    const moong = rows.find((r) => r.productId === 2)!
    expect(moong.closing).toBe(97_500)
  })
})

describe('summariseDrawer (paise)', () => {
  function stub(partial: Partial<Txn> & Pick<Txn, 'type' | 'voided'>): Txn {
    return {
      id: 'x',
      seq: 1,
      voucherSeq: null,
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
      total: 0,
      creditAmount: 0,
      discountAmount: 0,
      remarks: null,
      successorId: null,
      createdAt: '',
      lines: [],
      ...partial
    }
  }

  it('sums drawer columns and credit faces in paise', () => {
    const s = summariseDrawer([
      stub({ type: 'SA', voided: false, cashIn: 50_000, creditAmount: 0 }),
      stub({ type: 'SA', voided: false, cashIn: 0, creditAmount: 120_000 }),
      stub({ type: 'PU', voided: false, cashOut: 10_000, creditAmount: 80_000 }),
      stub({ type: 'RE', voided: false, cashIn: 5_000 }),
      stub({ type: 'SA', voided: true, cashIn: 999_999, creditAmount: 999_999 })
    ])
    expect(s.cashIn).toBe(55_000)
    expect(s.cashOut).toBe(10_000)
    expect(s.cashNet).toBe(45_000)
    expect(s.creditIssued).toBe(120_000)
    expect(s.creditReceived).toBe(80_000)
  })
})
