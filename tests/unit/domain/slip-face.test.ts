import { describe, expect, it } from 'vitest'
import {
  isWalkinTxn,
  slipFaceCustomerName,
  slipFacePlace,
  slipFaceProductName
} from '@domain/slip-face'

describe('slip-face (ADR-0003)', () => {
  describe('isWalkinTxn', () => {
    it('is walk-in when customerId is null', () => {
      expect(isWalkinTxn({ customerId: null, walkinName: 'Walk in' })).toBe(true)
    })
    it('is master when customerId is set', () => {
      expect(isWalkinTxn({ customerId: 1, walkinName: null })).toBe(false)
    })
  })

  describe('slipFaceCustomerName', () => {
    it('uses walk-in English (including placeholder)', () => {
      expect(slipFaceCustomerName({ isWalkin: true, walkinName: 'Counter', nameTe: 'రవి' })).toBe(
        'Counter'
      )
      expect(slipFaceCustomerName({ isWalkin: true, walkinName: 'Walk in', nameTe: null })).toBe(
        'Walk in'
      )
      expect(slipFaceCustomerName({ isWalkin: true, walkinName: '', nameTe: null })).toBe('Walk in')
    })

    it('uses Telugu for master; blank when missing (no English fallback)', () => {
      expect(
        slipFaceCustomerName({ isWalkin: false, walkinName: null, nameTe: 'రవి కుమార్' })
      ).toBe('రవి కుమార్')
      expect(slipFaceCustomerName({ isWalkin: false, walkinName: null, nameTe: null })).toBe('')
      expect(slipFaceCustomerName({ isWalkin: false, walkinName: null, nameTe: '  ' })).toBe('')
    })
  })

  describe('slipFacePlace', () => {
    it('uses walk-in English place', () => {
      expect(slipFacePlace({ isWalkin: true, walkinPlace: 'Guntur', placeTe: 'గుంటూరు' })).toBe(
        'Guntur'
      )
      expect(slipFacePlace({ isWalkin: true, walkinPlace: '', placeTe: null })).toBe('')
    })

    it('uses Telugu for master; blank when missing (no English fallback)', () => {
      expect(slipFacePlace({ isWalkin: false, walkinPlace: null, placeTe: 'గుంటూరు' })).toBe(
        'గుంటూరు'
      )
      expect(slipFacePlace({ isWalkin: false, walkinPlace: null, placeTe: null })).toBe('')
    })
  })

  describe('slipFaceProductName', () => {
    it('prefers Telugu and falls back to English when empty', () => {
      expect(slipFaceProductName('Toor Dal', 'కందిపప్పు')).toBe('కందిపప్పు')
      expect(slipFaceProductName('Toor Dal', null)).toBe('Toor Dal')
      expect(slipFaceProductName('Toor Dal', '')).toBe('Toor Dal')
      expect(slipFaceProductName('Toor Dal', '  ')).toBe('Toor Dal')
    })
  })
})
