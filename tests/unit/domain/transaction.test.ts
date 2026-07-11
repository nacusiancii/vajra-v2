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

describe('lineStockDelta', () => {
  it('packaged moves whole units', () => {
    expect(
      lineStockDelta({
        productType: 'packaged',
        qty: 3,
        bagSizeKg: null,
        defaultBagSizeKg: null,
        direction: -1
      })
    ).toBe(-3)
  })

  it('bulk default bag is one unit per bag', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 2,
        bagSizeKg: 50,
        defaultBagSizeKg: 50,
        direction: 1
      })
    ).toBe(2)
  })

  it('bulk non-default bag moves fractional stock', () => {
    // a 25kg bag against a 50kg default is half a unit
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 1,
        bagSizeKg: 25,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-0.5)
  })

  it('30kg bag against 50kg default is 0.6 units per bag', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 5,
        bagSizeKg: 30,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-3)
  })

  it('custom 40kg bag against 50kg default is 0.8 units per bag', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 5,
        bagSizeKg: 40,
        defaultBagSizeKg: 50,
        direction: 1
      })
    ).toBe(4)
  })

  it('missing bag sizes falls back to raw qty (edge / incomplete line)', () => {
    expect(
      lineStockDelta({
        productType: 'bulk',
        qty: 3,
        bagSizeKg: null,
        defaultBagSizeKg: 50,
        direction: -1
      })
    ).toBe(-3)
  })
})

describe('projectInventory', () => {
  const products: ProjectionProduct[] = [
    { id: 1, name: 'Toor Dal', productGroupName: 'Dal', type: 'bulk', defaultBagSizeKg: 50 },
    { id: 2, name: 'Atta 1kg', productGroupName: 'Flour', type: 'packaged', defaultBagSizeKg: null }
  ]

  it('opening + purchased - sold + transfers = closing', () => {
    const opening = new Map<number, number>([
      [1, 10],
      [2, 100]
    ])
    const movements: ProjectionMovement[] = [
      { productId: 1, type: 'PU', stockDelta: 5 }, // purchased 5 bags
      { productId: 1, type: 'SA', stockDelta: -2 }, // sold 2 bags
      { productId: 1, type: 'ST', stockDelta: -1 }, // transferred out 1 bag
      { productId: 2, type: 'SA', stockDelta: -30 }
    ]
    const rows = projectInventory(products, opening, movements)
    const dal = rows.find((r) => r.productId === 1)!
    expect(dal.opening).toBe(10)
    expect(dal.purchased).toBe(5)
    expect(dal.sold).toBe(2)
    expect(dal.transferOut).toBe(1)
    expect(dal.closing).toBe(12)
    expect(dal.negative).toBe(false)

    const atta = rows.find((r) => r.productId === 2)!
    expect(atta.closing).toBe(70)
  })

  it('flags projected-negative stock without throwing', () => {
    const rows = projectInventory(products, new Map([[2, 5]]), [
      { productId: 2, type: 'SA', stockDelta: -8 }
    ])
    const atta = rows.find((r) => r.productId === 2)!
    expect(atta.closing).toBe(-3)
    expect(atta.negative).toBe(true)
  })
})

describe('summariseDrawer', () => {
  function txn(partial: Partial<Txn>): Txn {
    return {
      id: 'x',
      type: 'SA',
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
      remarks: null,
      voided: false,
      successorId: null,
      createdAt: '',
      lines: [],
      ...partial
    }
  }

  it('nets cash and upi and ignores voided rows', () => {
    const s = summariseDrawer([
      txn({ type: 'SA', cashIn: 100, upiIn: 50 }),
      txn({ type: 'EX', cashOut: 30 }),
      txn({ type: 'PA', upiOut: 20 }),
      txn({ type: 'SA', cashIn: 999, voided: true }),
      txn({ type: 'SA', saleMode: 'credit', creditAmount: 200 }),
      txn({ type: 'RE', cashIn: 75 }),
      txn({ type: 'PU', saleMode: 'credit', creditAmount: 150 })
    ])
    expect(s.cashIn).toBe(175)
    expect(s.upiIn).toBe(50)
    expect(s.cashOut).toBe(30)
    expect(s.upiOut).toBe(20)
    expect(s.cashNet).toBe(145)
    expect(s.upiNet).toBe(30)
    expect(s.creditIssued).toBe(200)
    expect(s.creditReceived).toBe(150)
  })

  it('creditReceived sums Purchase creditAmount only; Receipts stay on cash/UPI in', () => {
    const s = summariseDrawer([
      txn({ type: 'PU', saleMode: 'credit', creditAmount: 400 }),
      txn({ type: 'PU', saleMode: 'credit', creditAmount: 100 }),
      txn({ type: 'PU', saleMode: 'cash', cashOut: 50 }),
      txn({ type: 'RE', cashIn: 75, upiIn: 25 }),
      txn({ type: 'PU', saleMode: 'credit', creditAmount: 999, voided: true })
    ])
    expect(s.creditReceived).toBe(500)
    expect(s.cashIn).toBe(75)
    expect(s.upiIn).toBe(25)
    expect(s.cashOut).toBe(50)
    expect(s.creditIssued).toBe(0)
  })

  it('creditIssued sums Sale creditAmount only; cash Sales and Purchases do not count', () => {
    const s = summariseDrawer([
      txn({ type: 'SA', saleMode: 'credit', creditAmount: 200 }),
      txn({ type: 'SA', saleMode: 'cash', cashIn: 80 }),
      txn({ type: 'PU', saleMode: 'credit', creditAmount: 300 }),
      txn({ type: 'SA', saleMode: 'credit', creditAmount: 50, voided: true })
    ])
    expect(s.creditIssued).toBe(200)
    expect(s.creditReceived).toBe(300)
    expect(s.cashIn).toBe(80)
  })
})
