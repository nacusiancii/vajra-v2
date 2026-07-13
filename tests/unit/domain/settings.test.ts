import { describe, it, expect } from 'vitest'
import { DEFAULT_SETTINGS } from '@domain/settings'

describe('DEFAULT_SETTINGS', () => {
  it('defaults to printerless mode', () => {
    expect(DEFAULT_SETTINGS.printerlessMode).toBe(true)
  })

  it('defaults max line items to 10', () => {
    expect(DEFAULT_SETTINGS.maxLineItems).toBe(10)
  })
})
