import { describe, it, expect } from 'vitest'
import {
  draftCapExceededMessage,
  validateDraftCounterparty,
  type SaleDraftPayload
} from '@domain/draft'

function basePayload(over: Partial<SaleDraftPayload> = {}): SaleDraftPayload {
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
    upiCollected: null,
    remarks: '',
    ...over
  }
}

describe('validateDraftCounterparty', () => {
  it('allows Customer Master on cash Sale', () => {
    expect(validateDraftCounterparty(basePayload())).toBeNull()
  })

  it('blocks cash Sale with neither customer nor walk-in', () => {
    expect(
      validateDraftCounterparty(basePayload({ customerId: null, counterpartyMode: 'customer' }))
    ).toMatch(/Customer Master|walk-in/i)
  })

  it('allows walk-in with name and place', () => {
    expect(
      validateDraftCounterparty(
        basePayload({
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: 'Ravi',
          walkinPlace: 'Guntur'
        })
      )
    ).toBeNull()
  })

  it('blocks walk-in missing place', () => {
    expect(
      validateDraftCounterparty(
        basePayload({
          counterpartyMode: 'walkin',
          customerId: null,
          walkinName: 'Ravi',
          walkinPlace: '  '
        })
      )
    ).toMatch(/walk-in name and place/i)
  })

  it('blocks credit Sale without Customer Master', () => {
    expect(
      validateDraftCounterparty(
        basePayload({
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

describe('draftCapExceededMessage', () => {
  it('names the cap clearly', () => {
    expect(draftCapExceededMessage(5)).toMatch(/5/)
    expect(draftCapExceededMessage(5)).toMatch(/Draft limit/i)
  })
})
