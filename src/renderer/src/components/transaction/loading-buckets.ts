import type { ProductType } from '@domain/types'

/** One Bag Type's contribution to the cart's Loading Charge (for display). */
export interface LoadingBagBucket {
  bagSizeKg: number
  bagCount: number
  ratePerBag: number
}

/** Group bulk cart lines by Bag Type for the Settle receipt breakdown. */
export function loadingChargeBuckets(
  lines: Array<{ productType: ProductType; bagSizeKg: number | null; qty: number }>,
  ratePerBagBySize: Record<number, number>
): LoadingBagBucket[] {
  const map = new Map<number, LoadingBagBucket>()
  for (const l of lines) {
    if (l.productType !== 'bulk' || !l.bagSizeKg || !(l.qty > 0)) continue
    const rate = ratePerBagBySize[l.bagSizeKg] ?? 0
    const existing = map.get(l.bagSizeKg)
    if (existing) {
      existing.bagCount += l.qty
    } else {
      map.set(l.bagSizeKg, {
        bagSizeKg: l.bagSizeKg,
        bagCount: l.qty,
        ratePerBag: rate
      })
    }
  }
  return [...map.values()].sort((a, b) => a.bagSizeKg - b.bagSizeKg)
}
