<script setup lang="ts">
/**
 * Variant C shell — asymmetric master-detail (invoice panel + amber voucher rail).
 * C-iteration (#115): print-control treatments C1|C2|C3 share this shell.
 *
 * Product rules (exploration fork):
 * - Credit Voucher is the non-negotiable signed paper (locked will-print).
 * - Sale Invoice is optional helper paper; may be skipped entirely.
 * - When invoice is on, copies are 1x or 2x.
 */
import { computed, ref } from 'vue'
import { ChevronDown, ChevronUp, Lock, Printer } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatRupees } from '@/lib/format'
import PrototypeInvoiceCard from './PrototypeInvoiceCard.vue'
import PrototypeVoucherCard from './PrototypeVoucherCard.vue'
import PrintControlsC1 from './PrintControlsC1.vue'
import PrintControlsC2 from './PrintControlsC2.vue'
import PrintControlsC3 from './PrintControlsC3.vue'
import type { PrototypeCreditFinish } from './mockData'
import { usePrintInvoiceState } from './usePrintInvoiceState'

const props = withDefaults(
  defineProps<{
    data: PrototypeCreditFinish
    /** Print-control structural treatment on the C shell. */
    printStyle?: 'C1' | 'C2' | 'C3'
  }>(),
  { printStyle: 'C1' }
)

const open = ref(true)
const { printInvoice, invoiceCopies } = usePrintInvoiceState()
/** When false, voucher rail shows front summary only; expand for full front+back. */
const voucherExpanded = ref(false)

/**
 * C1: dim invoice when off (still visible).
 * C2: hide invoice column when off (layout reflows to voucher-forward).
 * C3: dim invoice when off (voucher-first controls; same master-detail frame).
 */
const showInvoiceColumn = computed(() => {
  if (props.printStyle === 'C2' && !printInvoice.value) return false
  return true
})

const invoiceDimmed = computed(() => !printInvoice.value && showInvoiceColumn.value)

const gridClass = computed(() => {
  if (!showInvoiceColumn.value) {
    return 'grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden'
  }
  return 'grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] gap-3 overflow-hidden'
})

defineExpose({ name: `Master-detail · print ${props.printStyle}` })
</script>

<template>
  <Dialog :open="open" @update:open="(v) => (open = v)">
    <DialogContent
      class="flex max-h-[92vh] w-full flex-col gap-3 sm:max-w-4xl"
      :data-testid="`prototype-variant-${printStyle.toLowerCase()}`"
      :data-print-style="printStyle"
    >
      <DialogHeader class="shrink-0">
        <DialogTitle class="flex flex-wrap items-center gap-2">
          Credit Sale ready
          <Badge variant="secondary" class="font-normal"> Sale No. {{ data.saleSeq }} </Badge>
          <Badge
            variant="outline"
            class="border-amber-400/60 font-normal text-amber-900 dark:text-amber-200"
          >
            Voucher No. {{ data.voucherSeq }}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          Credit Voucher is the signed, locked paper that always prints. Sale Invoice is optional
          helper paper — the cashier may skip invoice copies entirely.
        </DialogDescription>
      </DialogHeader>

      <!-- Always use explicit columns: viewport breakpoints don't apply inside a fixed dialog. -->
      <div :class="gridClass">
        <!-- Master: print controls first (hero of this iteration), then optional invoice -->
        <div v-if="showInvoiceColumn" class="min-h-0 space-y-3 overflow-y-auto">
          <PrintControlsC1
            v-if="printStyle === 'C1'"
            v-model:print-invoice="printInvoice"
            v-model:invoice-copies="invoiceCopies"
          />
          <PrintControlsC2
            v-else-if="printStyle === 'C2'"
            v-model:print-invoice="printInvoice"
            v-model:invoice-copies="invoiceCopies"
          />
          <PrintControlsC3
            v-else
            v-model:print-invoice="printInvoice"
            v-model:invoice-copies="invoiceCopies"
          />

          <div class="relative" data-testid="prototype-invoice-panel">
            <div
              :class="invoiceDimmed ? 'pointer-events-none opacity-40 grayscale' : ''"
              class="transition-opacity"
            >
              <PrototypeInvoiceCard :data="data" />
            </div>
            <div
              v-if="invoiceDimmed"
              class="absolute inset-0 flex items-start justify-center pt-8"
              data-testid="prototype-invoice-not-printing"
            >
              <Badge
                variant="secondary"
                class="border border-dashed border-muted-foreground/50 bg-background/90 px-3 py-1.5 text-sm font-medium shadow-sm"
              >
                Not printing
              </Badge>
            </div>
            <Badge
              v-else-if="printInvoice"
              variant="outline"
              class="absolute right-2 top-2 bg-background/90 tabular-nums"
              data-testid="prototype-invoice-copies-badge"
            >
              {{ invoiceCopies }}× print
            </Badge>
          </div>
        </div>

        <!-- When C2 hides invoice column, print controls sit above voucher -->
        <div
          v-if="!showInvoiceColumn"
          class="min-h-0 space-y-3 overflow-y-auto"
          data-testid="prototype-c2-invoice-off-stack"
        >
          <PrintControlsC2
            v-model:print-invoice="printInvoice"
            v-model:invoice-copies="invoiceCopies"
          />
          <aside
            class="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/40"
            data-testid="prototype-voucher-rail"
          >
            <div
              class="flex items-center justify-between gap-2 border-b border-amber-300/60 px-3 py-2"
            >
              <div>
                <p class="text-sm font-semibold">Credit Voucher</p>
                <p class="text-xs text-muted-foreground tabular-nums">
                  No. {{ data.voucherSeq }} · {{ formatRupees(data.total) }}
                </p>
              </div>
              <Badge variant="secondary" class="gap-1 shrink-0">
                <Lock class="size-3" />
                will print
              </Badge>
            </div>
            <div class="min-h-0 flex-1 overflow-y-auto p-3">
              <PrototypeVoucherCard
                :data="data"
                :face="voucherExpanded ? 'both' : 'front'"
                compact
              />
            </div>
            <div class="border-t border-amber-300/60 p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                class="w-full"
                data-testid="prototype-expand-voucher"
                @click="voucherExpanded = !voucherExpanded"
              >
                <ChevronDown v-if="!voucherExpanded" class="mr-1 size-4" />
                <ChevronUp v-else class="mr-1 size-4" />
                {{ voucherExpanded ? 'Collapse voucher back' : 'Show voucher back (lines)' }}
              </Button>
            </div>
          </aside>
        </div>

        <!-- Detail rail: voucher (two-column layout) -->
        <aside
          v-if="showInvoiceColumn"
          class="flex min-h-0 flex-col overflow-hidden rounded-lg border-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/40"
          data-testid="prototype-voucher-rail"
        >
          <div
            class="flex items-center justify-between gap-2 border-b border-amber-300/60 px-3 py-2"
          >
            <div>
              <p class="text-sm font-semibold">Credit Voucher</p>
              <p class="text-xs text-muted-foreground tabular-nums">
                No. {{ data.voucherSeq }} · {{ formatRupees(data.total) }}
              </p>
            </div>
            <Badge variant="secondary" class="gap-1 shrink-0">
              <Lock class="size-3" />
              will print
            </Badge>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto p-3">
            <PrototypeVoucherCard :data="data" :face="voucherExpanded ? 'both' : 'front'" compact />
          </div>

          <div class="border-t border-amber-300/60 p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="w-full"
              data-testid="prototype-expand-voucher"
              @click="voucherExpanded = !voucherExpanded"
            >
              <ChevronDown v-if="!voucherExpanded" class="mr-1 size-4" />
              <ChevronUp v-else class="mr-1 size-4" />
              {{ voucherExpanded ? 'Collapse voucher back' : 'Show voucher back (lines)' }}
            </Button>
          </div>
        </aside>
      </div>

      <DialogFooter class="shrink-0 border-t pt-3">
        <Button data-testid="prototype-done" @click="open = false">
          <Printer class="mr-2 size-4" />
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
