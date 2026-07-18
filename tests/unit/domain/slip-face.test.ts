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
      expect(isWalkinTxn({ customerId: null })).toBe(true)
    })
    it('is master when customerId is set', () => {
      expect(isWalkinTxn({ customerId: 1 })).toBe(false)
    })
  })

  describe('slipFaceCustomerName', () => {
    it('uses walk-in English (including placeholder)', () => {
      expect(
        slipFaceCustomerName({
          isWalkin: true,
          walkinName: 'Counter',
          nameTe: 'రవి',
          nameEn: 'Ravi'
        })
      ).toBe('Counter')
      expect(
        slipFaceCustomerName({
          isWalkin: true,
          walkinName: 'Walk in',
          nameTe: null,
          nameEn: null
        })
      ).toBe('Walk in')
      expect(
        slipFaceCustomerName({ isWalkin: true, walkinName: '', nameTe: null, nameEn: null })
      ).toBe('Walk in')
    })

    it('uses Telugu for master when set; English when missing', () => {
      expect(
        slipFaceCustomerName({
          isWalkin: false,
          walkinName: null,
          nameTe: 'రవి కుమార్',
          nameEn: 'Ravi Kumar'
        })
      ).toBe('రవి కుమార్')
      expect(
        slipFaceCustomerName({
          isWalkin: false,
          walkinName: null,
          nameTe: null,
          nameEn: 'Ravi Kumar'
        })
      ).toBe('Ravi Kumar')
      expect(
        slipFaceCustomerName({
          isWalkin: false,
          walkinName: null,
          nameTe: '  ',
          nameEn: 'Ravi Kumar'
        })
      ).toBe('Ravi Kumar')
    })
  })

  describe('slipFacePlace', () => {
    it('uses walk-in English place', () => {
      expect(
        slipFacePlace({
          isWalkin: true,
          walkinPlace: 'Guntur',
          placeTe: 'గుంటూరు',
          placeEn: 'Guntur'
        })
      ).toBe('Guntur')
      expect(slipFacePlace({ isWalkin: true, walkinPlace: '', placeTe: null, placeEn: null })).toBe(
        ''
      )
    })

    it('uses Telugu for master when set; English when missing', () => {
      expect(
        slipFacePlace({
          isWalkin: false,
          walkinPlace: null,
          placeTe: 'గుంటూరు',
          placeEn: 'Guntur'
        })
      ).toBe('గుంటూరు')
      expect(
        slipFacePlace({
          isWalkin: false,
          walkinPlace: null,
          placeTe: null,
          placeEn: 'Guntur'
        })
      ).toBe('Guntur')
      expect(
        slipFacePlace({
          isWalkin: false,
          walkinPlace: null,
          placeTe: '  ',
          placeEn: 'Guntur'
        })
      ).toBe('Guntur')
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
