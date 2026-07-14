/**
 * PROTOTYPE ONLY — mock Credit Sale finish payload for dual-panel layout exploration.
 * Numbers are equal on purpose (eventual #81/#82 scheme); no real mutations.
 * Money = integer paise; bag mass = grams.
 */

export interface PrototypeLine {
  id: string
  productName: string
  isLoose: boolean
  qty: number
  bagSizeG: number | null
  quintalRate: number | null
  perKgRate: number | null
  lineTotal: number
}

export interface PrototypeCreditFinish {
  companyName: string
  date: string
  saleSeq: number
  voucherSeq: number
  customerName: string
  place: string
  phone: string
  lines: PrototypeLine[]
  loadingCharges: number
  additionalCharges: number
  total: number
  printerless: boolean
}

/** Sale No. 3 ≡ Voucher No. 3 — mock equal labels for dual-panel review. */
export const MOCK_CREDIT_FINISH: PrototypeCreditFinish = {
  companyName: 'Sri Venkateswara Traders',
  date: '2026-07-14',
  saleSeq: 3,
  voucherSeq: 3,
  customerName: 'Ravi Kumar',
  place: 'Guntur',
  phone: '9876543210',
  lines: [
    {
      id: 'line-1',
      productName: 'Toor Dal',
      isLoose: false,
      qty: 2,
      bagSizeG: 50_000,
      quintalRate: 600_000,
      perKgRate: null,
      lineTotal: 600_000
    },
    {
      id: 'line-2',
      productName: 'Moong Dal (Loose)',
      isLoose: true,
      qty: 5,
      bagSizeG: null,
      quintalRate: null,
      perKgRate: 12_000,
      lineTotal: 60_000
    }
  ],
  loadingCharges: 5_000,
  additionalCharges: 0,
  total: 665_000,
  printerless: true
}

/** Format YYYY-MM-DD → DD/MM/YYYY for slip faces. */
export function displayDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso || '—'
  return `${m[3]}/${m[2]}/${m[1]}`
}
