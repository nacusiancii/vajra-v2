/** A cart line while being edited — rates may be empty until typed. Rates are paise; bag sizes grams. */
export interface CartLine {
  productId: number | null
  isLoose: boolean
  bagSizeG: number | null
  quintalRate: number | null
  perKgRate: number | null
  qty: number | null
}

/** Blank goods row for new carts and manual Add Line — not auto-appended/reseeded. */
export function emptyCartLine(): CartLine {
  return {
    productId: null,
    isLoose: false,
    bagSizeG: null,
    quintalRate: null,
    perKgRate: null,
    qty: null
  }
}
