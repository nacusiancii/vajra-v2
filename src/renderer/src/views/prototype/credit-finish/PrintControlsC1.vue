<script setup lang="ts">
/**
 * C1 (winning print treatment) — minimal decision surface:
 *
 *   [ ] Print invoice   [2x]
 *
 * - Checkbox: opt-in, default OFF (invoice optional on Credit Sale).
 * - `2x` tag: opt-out, default ON when invoice is enabled (one click → 1x).
 * - No business/master "always prints" copy — cashiers already know that.
 * - Credit Voucher is not a Print Queue decision (amber rail shows will-print).
 */
import { computed } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { InvoiceCopies } from './usePrintInvoiceState'

const printInvoice = defineModel<boolean>('printInvoice', { required: true })
const invoiceCopies = defineModel<InvoiceCopies>('invoiceCopies', { required: true })

/** `2x` tag is pressed by default (opt-out); off means 1 copy. */
const twoXActive = computed(() => invoiceCopies.value === 2)

function onToggleTwoX(): void {
  if (!printInvoice.value) return
  invoiceCopies.value = invoiceCopies.value === 2 ? 1 : 2
}
</script>

<template>
  <div
    class="rounded-md border bg-muted/40 p-3 text-sm"
    data-testid="prototype-print-controls"
    data-print-style="c1"
  >
    <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Print queue
    </p>

    <!-- Decision only: [ ] Print invoice  [2x] -->
    <div class="flex flex-wrap items-center gap-2" data-testid="prototype-invoice-row">
      <Checkbox
        id="proto-c1-invoice"
        :model-value="printInvoice"
        data-testid="prototype-print-invoice"
        @update:model-value="(v) => (printInvoice = v === true)"
      />
      <Label for="proto-c1-invoice" class="cursor-pointer font-medium">Print invoice</Label>

      <!-- Tag: always says "2x"; pressed = 2 copies (default), click opts out to 1 -->
      <button
        type="button"
        class="inline-flex h-6 min-w-[2rem] items-center justify-center rounded-full border px-2 text-xs font-semibold tabular-nums transition-colors"
        :class="
          !printInvoice
            ? 'cursor-not-allowed border-muted-foreground/20 bg-muted text-muted-foreground opacity-50'
            : twoXActive
              ? 'border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
              : 'border-muted-foreground/30 bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground'
        "
        :disabled="!printInvoice"
        :aria-pressed="printInvoice ? twoXActive : undefined"
        :aria-label="
          twoXActive
            ? '2 invoice copies (on). Click to print 1 copy.'
            : '1 invoice copy. Click for 2 copies.'
        "
        data-testid="prototype-invoice-copies-tag"
        @click="onToggleTwoX"
      >
        2x
      </button>
    </div>
  </div>
</template>
