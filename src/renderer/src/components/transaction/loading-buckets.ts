import type { ProductType } from '@domain/types'

/** One Bag Type's contribution to the cart's Loading Charge (for display). */
export interface LoadingBagBucket {
  bagSizeG: number
  bagCount: number
  ratePerBag: number
}

/** Group bulk cart lines by Bag Type for the Settle receipt breakdown. */
export function loadingChargeBuckets(
  lines: Array<{ productType: ProductType; bagSizeG: number | null; qty: number }>,
  ratePerBagBySize: Record<number, number>
): LoadingBagBucket[] {
  const map = new Map<number, LoadingBagBucket>()
  for (const l of lines) {
    if (l.productType !== 'bulk' || !l.bagSizeG || !(l.qty > 0)) continue
    const rate = ratePerBagBySize[l.bagSizeG] ?? 0
    const existing = map.get(l.bagSizeG)
    if (existing) {
      existing.bagCount += l.qty
    } else {
      map.set(l.bagSizeG, {
        bagSizeG: l.bagSizeG,
        bagCount: l.qty,
        ratePerBag: rate
      })
    }
  }
  return [...map.values()].sort((a, b) => a.bagSizeG - b.bagSizeG)
}
