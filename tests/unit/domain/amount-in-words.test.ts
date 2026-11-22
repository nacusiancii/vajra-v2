import { describe, expect, it } from 'vitest'
import { amountInWords } from '../../../src/domain/amount-in-words'

describe('amountInWords (Indian numbering, paise in)', () => {
  it.each([
    [1_487_500, 'Fourteen Thousand Eight Hundred Seventy Five Rupees only'],
    [18_409_000, 'One Lakh Eighty Four Thousand Ninety Rupees only'],
    [
      1_234_567_800,
      'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees only'
    ],
    [100_000, 'One Thousand Rupees only'],
    [1_050, 'Ten Rupees and Fifty Paise only'],
    [0, 'Zero Rupees only']
  ])('%i paise → %s', (paise, words) => {
    expect(amountInWords(paise)).toBe(words)
  })
})
