import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '@domain/settings'

describe('DEFAULT_SETTINGS', () => {
  it('defaults to printing (Printerless Mode off)', () => {
    expect(DEFAULT_SETTINGS.printerless).toBe(false)
  })
})
