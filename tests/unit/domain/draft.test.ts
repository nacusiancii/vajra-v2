import { describe, it, expect } from 'vitest'
import {
  draftCapExceededMessage,
  normalizeDraftWalkinFields,
  validatePurchaseDraftCounterparty,
  validateSaleDraftCounterparty,
  type PurchaseDraftPayload,
  type SaleDraftPayload
} from '@domain/draft'
import { WALKIN_PLACEHOLDER } from '@domain/transaction'

function salePayload(over: Partial<SaleDraftPayload> = {}): SaleDraftPayload {
  return {
    mode: 'cash',
    counterpartyMode: 'customer',
    customerId: 1,
    walkinName: '',
    walkinPlace: '',
    walkinPhone: '',
    lines: [],
    applyLoading: false,
    additionalCharges: null,
    discountAmount: null,
    upiCollected: null,
    remarks: '',
    ...over
  }
}

function purchasePayload(over: Partial<PurchaseDraftPayload> = {}): PurchaseDraftPayload {
  return {
    mode: 'cash',
    counterpartyMode: 'customer',
    customerId: 1,
    walkinName: '',
    walkinPlace: '',
    walkinPhone: '',
    lines: [],
    additionalCharges: null,
    upiCollected: null,
    remarks: '',
    ...over
  }
}

describe('validateSaleDraftCounterparty', () => {
  it('allows Customer Master on cash Sale', () => {
    expect(validateSaleDraftCounterparty(salePayload())).toBeNull()
  })

  it('blocks cash Sale with neither customer nor walk-in', () => {
    expect(
      validateSaleDraftCounterparty(salePayload({ customerId: null, counterpartyMode: 'customer' }))
    ).toMatch(/Customer Master|walk-in/i)
  })

  it('allows walk-in with name and place', () => {
    expect(
      validateSaleDraftCounterparty(
        salePayload({
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: 'Ravi',
          walkinPlace: 'Guntur'
        })
      )
    ).toBeNull()
  })

  it('allows walk-in with blank name and place (placeholder filled on save)', () => {
    expect(
      validateSaleDraftCounterparty(
        salePayload({
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: '',
          walkinPlace: '  '
        })
      )
    ).toBeNull()
  })

  it('blocks credit Sale without Customer Master', () => {
    expect(
      validateSaleDraftCounterparty(
        salePayload({
          mode: 'credit',
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: 'X',
          walkinPlace: 'Y'
        })
      )
    ).toMatch(/Customer Master/i)
  })
})

describe('validatePurchaseDraftCounterparty', () => {
  it('allows Customer Master on cash Purchase', () => {
    expect(validatePurchaseDraftCounterparty(purchasePayload())).toBeNull()
  })

  it('blocks Purchase with neither customer nor walk-in', () => {
    expect(
      validatePurchaseDraftCounterparty(
        purchasePayload({ customerId: null, counterpartyMode: 'customer' })
      )
    ).toMatch(/Customer Master|walk-in/i)
  })

  it('allows walk-in with name and place on cash Purchase', () => {
    expect(
      validatePurchaseDraftCounterparty(
        purchasePayload({
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: 'Supplier Co',
          walkinPlace: 'Ongole'
        })
      )
    ).toBeNull()
  })

  it('allows walk-in on credit Purchase (unlike Sale)', () => {
    expect(
      validatePurchaseDraftCounterparty(
        purchasePayload({
          mode: 'credit',
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: 'Supplier Co',
          walkinPlace: 'Ongole'
        })
      )
    ).toBeNull()
  })

  it('allows walk-in with blank name and place on Purchase', () => {
    expect(
      validatePurchaseDraftCounterparty(
        purchasePayload({
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: '',
          walkinPlace: ''
        })
      )
    ).toBeNull()
  })
})

describe('normalizeDraftWalkinFields', () => {
  it('fills blank walk-in name and place with the placeholder', () => {
    const out = normalizeDraftWalkinFields(
      salePayload({
        counterpartyMode: 'walkin',
        customerId: null,
        walkinName: '  ',
        walkinPlace: ''
      })
    )
    expect(out.walkinName).toBe(WALKIN_PLACEHOLDER)
    expect(out.walkinPlace).toBe(WALKIN_PLACEHOLDER)
  })

  it('preserves typed walk-in values', () => {
    const out = normalizeDraftWalkinFields(
      salePayload({
        counterpartyMode: 'walkin',
        customerId: null,
        walkinName: ' Ravi ',
        walkinPlace: 'Guntur'
      })
    )
    expect(out.walkinName).toBe('Ravi')
    expect(out.walkinPlace).toBe('Guntur')
  })

  it('leaves customer-mode payloads unchanged', () => {
    const inPayload = salePayload({ walkinName: '', walkinPlace: '' })
    expect(normalizeDraftWalkinFields(inPayload)).toEqual(inPayload)
  })
})

describe('draftCapExceededMessage', () => {
  it('names the cap and points to Clear or Settings', () => {
    const msg = draftCapExceededMessage(5)
    expect(msg).toMatch(/5/)
    expect(msg).toMatch(/Draft limit/i)
    expect(msg).toMatch(/Clear a Draft/i)
    expect(msg).toMatch(/Settings/i)
  })
})
