<script setup lang="ts">
/**
 * C3 — Voucher-first stack; Sale Invoice as optional chip + ± stepper pill.
 * Hierarchy: locked voucher on top; invoice is an add-on the cashier opens.
 */
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Lock, Minus, Plus, Printer } from '@lucide/vue'
import type { InvoiceCopies } from './usePrintInvoiceState'

const printInvoice = defineModel<boolean>('printInvoice', { required: true })
const invoiceCopies = defineModel<InvoiceCopies>('invoiceCopies', { required: true })

function enableInvoice(): void {
  printInvoice.value = true
  if (invoiceCopies.value < 1) invoiceCopies.value = 1
}

function disableInvoice(): void {
  printInvoice.value = false
}

function step(delta: -1 | 1): void {
  if (!printInvoice.value) return
  const next = invoiceCopies.value + delta
  if (next < 1) {
    printInvoice.value = false
    return
  }
  if (next > 2) return
  invoiceCopies.value = next as InvoiceCopies
}
</script>

<template>
  <div
    class="space-y-2 rounded-md border bg-muted/40 p-3 text-sm"
    data-testid="prototype-print-controls"
    data-print-style="c3"
  >
    <p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      What leaves the printer
    </p>

    <!-- Voucher first / hero -->
    <div
      class="flex items-center justify-between gap-2 rounded-md border-2 border-amber-400 bg-amber-50/90 px-3 py-2.5 dark:bg-amber-950/50"
      data-testid="prototype-voucher-will-print"
    >
      <div class="flex items-center gap-2">
        <Printer class="size-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <div>
          <p class="font-semibold">Credit Voucher</p>
          <p class="text-xs text-muted-foreground">Non-negotiable · customer signs</p>
        </div>
      </div>
      <Badge variant="secondary" class="gap-1 shrink-0">
        <Lock class="size-3" />
        will print
      </Badge>
    </div>

    <!-- Invoice as optional chip / expand -->
    <div v-if="!printInvoice" data-testid="prototype-invoice-chip-off">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
        data-testid="prototype-add-invoice-chip"
        @click="enableInvoice"
      >
        <Plus class="size-3.5" />
        Add Sale Invoice?
      </button>
      <p class="mt-1.5 text-xs text-muted-foreground">Optional — leave off if voucher is enough.</p>
    </div>

    <div
      v-else
      class="rounded-md border border-primary/30 bg-background p-2.5"
      data-testid="prototype-invoice-chip-on"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p class="text-sm font-medium">Sale Invoice</p>
          <p class="text-xs text-muted-foreground">Optional helper paper</p>
        </div>
        <div class="flex items-center gap-1.5">
          <div
            class="inline-flex items-center rounded-full border bg-muted/50 px-0.5"
            data-testid="prototype-copies-stepper"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="size-7 rounded-full p-0"
              aria-label="Fewer invoice copies"
              data-testid="prototype-copies-minus"
              @click="step(-1)"
            >
              <Minus class="size-3.5" />
            </Button>
            <span
              class="min-w-[2.25rem] text-center text-xs font-semibold tabular-nums"
              data-testid="prototype-copies-label"
            >
              {{ invoiceCopies }}x
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="size-7 rounded-full p-0"
              :disabled="invoiceCopies >= 2"
              aria-label="More invoice copies"
              data-testid="prototype-copies-plus"
              @click="step(1)"
            >
              <Plus class="size-3.5" />
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            class="h-7 px-2 text-xs text-muted-foreground"
            data-testid="prototype-remove-invoice"
            @click="disableInvoice"
          >
            Remove
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
