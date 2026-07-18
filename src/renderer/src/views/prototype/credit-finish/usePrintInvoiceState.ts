/**
 * PROTOTYPE ONLY — shared print state for Credit Sale finish C-iteration.
 *
 * Product rules under exploration (fork vs ADR-0008):
 * - Credit Voucher always prints (locked).
 * - Sale Invoice is optional; cashier may skip entirely.
 * - When invoice is on, copy count is 1 or 2.
 *
 * Default: invoice OFF (opt-in), copies ready at 2x when enabled (opt-out).
 */
import { ref, type Ref } from 'vue'

export type InvoiceCopies = 1 | 2

export function usePrintInvoiceState(): {
  printInvoice: Ref<boolean>
  invoiceCopies: Ref<InvoiceCopies>
  toggleCopies: () => void
  setCopies: (n: InvoiceCopies) => void
  cycleCopies: () => void
  stepCopies: (delta: -1 | 1) => void
} {
  const printInvoice = ref(false)
  const invoiceCopies = ref<InvoiceCopies>(2)

  function cycleCopies(): void {
    invoiceCopies.value = invoiceCopies.value === 1 ? 2 : 1
  }

  function toggleCopies(): void {
    if (!printInvoice.value) return
    cycleCopies()
  }

  function setCopies(n: InvoiceCopies): void {
    invoiceCopies.value = n
    if (n >= 1) printInvoice.value = true
  }

  function stepCopies(delta: -1 | 1): void {
    if (!printInvoice.value) return
    const next = invoiceCopies.value + delta
    if (next < 1) {
      printInvoice.value = false
      return
    }
    if (next > 2) return
    invoiceCopies.value = next as InvoiceCopies
  }

  return { printInvoice, invoiceCopies, toggleCopies, setCopies, cycleCopies, stepCopies }
}
