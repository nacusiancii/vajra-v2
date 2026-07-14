<script setup lang="ts">
/**
 * Variant C — Asymmetric master-detail: Invoice primary + voucher as prominent rail/sheet.
 * Invoice dominates the dialog; voucher sits in an amber secondary rail (expandable full view).
 */
import { ref } from 'vue'
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
import PrintControls from './PrintControls.vue'
import type { PrototypeCreditFinish } from './mockData'

defineProps<{ data: PrototypeCreditFinish }>()

const open = ref(true)
const printCustomerCopy = ref(true)
/** When false, voucher rail shows front summary only; expand for full front+back. */
const voucherExpanded = ref(false)

defineExpose({ name: 'Master-detail (invoice + voucher rail)' })
</script>

<template>
  <Dialog :open="open" @update:open="(v) => (open = v)">
    <DialogContent
      class="flex max-h-[92vh] w-full flex-col gap-3 sm:max-w-4xl"
      data-testid="prototype-variant-c"
    >
      <DialogHeader class="shrink-0">
        <DialogTitle class="flex flex-wrap items-center gap-2">
          Sale Invoice ready
          <Badge variant="secondary" class="font-normal"> Sale No. {{ data.saleSeq }} </Badge>
        </DialogTitle>
        <DialogDescription>
          Invoice is the primary finish surface. Credit Voucher rides along as a signed secondary
          artifact (Voucher No. {{ data.voucherSeq }}) — always will print.
        </DialogDescription>
      </DialogHeader>

      <!-- Always side-by-side: viewport breakpoints don't apply inside a fixed dialog. -->
      <div
        class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] gap-3 overflow-hidden"
      >
        <!-- Master: invoice -->
        <div class="min-h-0 space-y-3 overflow-y-auto">
          <PrototypeInvoiceCard :data="data" />
          <PrintControls v-model:print-customer-copy="printCustomerCopy" />
        </div>

        <!-- Detail rail: voucher -->
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
