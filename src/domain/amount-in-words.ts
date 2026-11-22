/**
 * Amount in words for the Credit Voucher front, Indian numbering (lakh, crore),
 * matching how the shop writes it by hand: "Fourteen Thousand Eight Hundred
 * Seventy Five Rupees only". A wrong amount on a signed voucher is expensive,
 * so this is unit-tested.
 */

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen'
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

/** 0–99 in words ('' for 0). */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  return [TENS[Math.floor(n / 10)], ONES[n % 10]].filter(Boolean).join(' ')
}

/** Whole number in words using crore / lakh / thousand / hundred ('' for 0). */
function wholeInWords(n: number): string {
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  if (crore) parts.push(`${wholeInWords(crore)} Crore`)
  n %= 10_000_000
  const lakh = Math.floor(n / 100_000)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  n %= 100_000
  const thousand = Math.floor(n / 1000)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  n %= 1000
  const hundred = Math.floor(n / 100)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)
  n %= 100
  if (n) parts.push(twoDigits(n))
  return parts.join(' ')
}

/** Integer paise → "… Rupees [and … Paise] only". */
export function amountInWords(paise: number): string {
  if (!Number.isInteger(paise) || paise < 0) throw new Error('paise must be an integer ≥ 0')
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  const rupeePart = `${wholeInWords(rupees) || 'Zero'} Rupees`
  return rest ? `${rupeePart} and ${twoDigits(rest)} Paise only` : `${rupeePart} only`
}
