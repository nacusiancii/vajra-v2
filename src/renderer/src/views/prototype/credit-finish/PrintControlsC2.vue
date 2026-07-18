<script setup lang="ts">
/**
 * C2 — Segmented: "No invoice | 1 copy | 2 copies" as one control.
 * Mutually exclusive invoice decision; voucher stays locked below.
 */
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Lock, Printer } from '@lucide/vue'
import type { InvoiceCopies } from './usePrintInvoiceState'

const printInvoice = defineModel<boolean>('printInvoice', { required: true })
const invoiceCopies = defineModel<InvoiceCopies>('invoiceCopies', { required: true })

type Segment = 'none' | '1' | '2'

const active = computed<Segment>(() => {
  if (!printInvoice.value) return 'none'
  return invoiceCopies.value === 1 ? '1' : '2'
})

function select(seg: Segment): void {
  if (seg === 'none') {
    printInvoice.value = false
    return
  }
  printInvoice.value = true
  invoiceCopies.value = seg === '1' ? 1 : 2
}
</script>

<template>
  <div
    class="space-y-3 rounded-md border bg-muted/40 p-3 text-sm"
    data-testid="prototype-print-controls"
    data-print-style="c2"
  >
    <div class="space-y-1.5">
      <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Sale Invoice
      </p>
      <div
        class="grid grid-cols-3 gap-0.5 rounded-lg border bg-background p-0.5"
        role="group"
        aria-label="Sale Invoice print copies"
        data-testid="prototype-invoice-segmented"
      >
        <button
          type="button"
          class="rounded-md px-2 py-2 text-center text-xs font-medium transition-colors"
          :class="
            active === 'none'
              ? 'bg-zinc-900 text-zinc-50 shadow dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-muted-foreground hover:bg-muted'
          "
          data-testid="prototype-invoice-seg-none"
          @click="select('none')"
        >
          No invoice
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-2 text-center text-xs font-medium transition-colors"
          :class="
            active === '1'
              ? 'bg-zinc-900 text-zinc-50 shadow dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-muted-foreground hover:bg-muted'
          "
          data-testid="prototype-invoice-seg-1"
          @click="select('1')"
        >
          1 copy
        </button>
        <button
          type="button"
          class="rounded-md px-2 py-2 text-center text-xs font-medium transition-colors"
          :class="
            active === '2'
              ? 'bg-zinc-900 text-zinc-50 shadow dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-muted-foreground hover:bg-muted'
          "
          data-testid="prototype-invoice-seg-2"
          @click="select('2')"
        >
          2 copies
        </button>
      </div>
      <p class="text-xs text-muted-foreground">
        Optional helper paper — skip entirely if the voucher is enough.
      </p>
    </div>

    <div
      class="flex items-center justify-between gap-2 rounded-md border border-amber-300/70 bg-amber-50/80 px-2.5 py-2 dark:bg-amber-950/50"
      data-testid="prototype-voucher-will-print"
    >
      <div class="flex items-center gap-2">
        <Printer class="size-4 text-amber-700 dark:text-amber-300" />
        <div>
          <p class="font-medium">Credit Voucher</p>
          <p class="text-xs text-muted-foreground">Always prints · signed artifact</p>
        </div>
      </div>
      <Badge variant="secondary" class="gap-1">
        <Lock class="size-3" />
        will print
      </Badge>
    </div>
  </div>
</template>
