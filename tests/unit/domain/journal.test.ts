import { describe, it, expect } from 'vitest'
import {
  CreateJournalSchema,
  displayJournalSerial,
  journalNameMatchesCustomer,
  mergeDayList,
  parseCreateJournalInput,
  txnsFromDayEntries,
  type Journal
} from '@domain/journal'
import type { Txn } from '@domain/transaction'

function stubTxn(partial: Partial<Txn> & Pick<Txn, 'id' | 'createdAt'>): Txn {
  return {
    type: 'RE',
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
    voided: false,
    successorId: null,
    lines: [],
    ...partial
  }
}

function stubJournal(
  partial: Partial<Journal> & Pick<Journal, 'id' | 'seq' | 'createdAt'>
): Journal {
  return {
    rev: 0,
    debit: { name: 'Ravi', amount: 100, customerId: null },
    credit: null,
    remarks: null,
    voided: false,
    successorId: null,
    successorSerial: null,
    ...partial
  }
}

describe('CreateJournalSchema', () => {
  it('coerces string amounts and drops blank legs', () => {
    const result = parseCreateJournalInput({
      debit: { name: '  Ravi  ', amount: '5000', customerId: null },
      credit: { name: '  ', amount: 0, customerId: 9 },
      remarks: '  note  '
    })
    expect(result.debit).toEqual({ name: 'Ravi', amount: 5000, customerId: null })
    expect(result.credit).toBeNull()
    expect(result.remarks).toBe('note')
  })

  it('rejects empty journals and incomplete present legs with cashier messages', () => {
    const empty = CreateJournalSchema.safeParse({
      debit: { name: '', amount: '' },
      credit: { name: '  ', amount: null },
      remarks: null
    })
    expect(empty.success).toBe(false)
    if (!empty.success) {
      expect(empty.error.issues[0]?.message).toBe('Enter a debit or a credit.')
    }

    const noParty = CreateJournalSchema.safeParse({
      debit: { name: '', amount: 100 },
      credit: null,
      remarks: null
    })
    expect(noParty.success).toBe(false)
    if (!noParty.success) {
      expect(noParty.error.issues.some((i) => i.message === 'Enter a party.')).toBe(true)
    }

    const noAmount = CreateJournalSchema.safeParse({
      debit: { name: 'Ravi', amount: 0 },
      credit: null,
      remarks: null
    })
    expect(noAmount.success).toBe(false)
    if (!noAmount.success) {
      expect(noAmount.error.issues.some((i) => i.message === 'Enter an amount.')).toBe(true)
    }
  })
})

describe('displayJournalSerial', () => {
  it('is J-{seq} on rev 0 and J-{seq}.{rev} after Edit', () => {
    expect(displayJournalSerial({ seq: 1, rev: 0 })).toBe('J-1')
    expect(displayJournalSerial({ seq: 1, rev: 1 })).toBe('J-1.1')
  })
})

describe('journalNameMatchesCustomer', () => {
  it('trims and compares English names case-insensitively', () => {
    expect(journalNameMatchesCustomer('ravi', 'Ravi')).toBe(true)
    expect(journalNameMatchesCustomer('  Ravi  ', 'ravi')).toBe(true)
    expect(journalNameMatchesCustomer('Ravi Kumar', 'Ravi')).toBe(false)
  })
})

describe('mergeDayList', () => {
  it('sorts newest createdAt first, then id; journals stay out of txn extract', () => {
    const older = stubTxn({ id: 'RE-1-01012026', createdAt: '2026-01-01 10:00:00' })
    const newerTxn = stubTxn({ id: 'RE-2-01012026', createdAt: '2026-01-01 12:00:00' })
    const journal = stubJournal({ id: 1, seq: 1, createdAt: '2026-01-01 12:00:00' })
    const entries = mergeDayList([older, newerTxn], [journal])
    expect(entries.map((e) => e.id)).toEqual(['journal:1', 'RE-2-01012026', 'RE-1-01012026'])
    expect(txnsFromDayEntries(entries)).toEqual([newerTxn, older])
  })
})
