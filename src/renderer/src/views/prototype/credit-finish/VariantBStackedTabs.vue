<script setup lang="ts">
/**
 * Variant B — Stacked / tabbed full-width artifacts with clear step affordance.
 * One artifact at a time (narrow density), sticky print strip, explicit 1/2 steps.
 */
import { computed, ref } from 'vue'
import { Check, Printer } from '@lucide/vue'
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
import PrototypeInvoiceCard from './PrototypeInvoiceCard.vue'
import PrototypeVoucherCard from './PrototypeVoucherCard.vue'
import PrintControls from './PrintControls.vue'
import type { PrototypeCreditFinish } from './mockData'

defineProps<{ data: PrototypeCreditFinish }>()

const open = ref(true)
const printCustomerCopy = ref(true)
/** Which full-width artifact is in focus. */
const tab = ref<'invoice' | 'voucher'>('invoice')

const stepLabel = computed(() => (tab.value === 'invoice' ? 'Step 1 of 2' : 'Step 2 of 2'))

defineExpose({ name: 'Stacked tabs / steps' })
</script>

<template>
  <Dialog :open="open" @update:open="(v) => (open = v)">
    <DialogContent
      class="flex max-h-[92vh] w-full flex-col gap-3 sm:max-w-lg"
      data-testid="prototype-variant-b"
    >
      <DialogHeader class="shrink-0">
        <div class="flex items-center justify-between gap-2 pr-6">
          <DialogTitle>Review printed artifacts</DialogTitle>
          <Badge variant="outline" data-testid="prototype-step-badge">{{ stepLabel }}</Badge>
        </div>
        <DialogDescription>
          Full-width preview, one artifact at a time. Sale No. {{ data.saleSeq }} and Voucher No.
          {{ data.voucherSeq }} stay visible in both steps.
        </DialogDescription>
      </DialogHeader>

      <!-- Step tabs -->
      <div
        class="grid shrink-0 grid-cols-2 gap-1 rounded-lg border bg-muted/50 p-1"
        role="tablist"
        data-testid="prototype-step-tabs"
      >
        <button
          type="button"
          role="tab"
          class="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            tab === 'invoice'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
          :aria-selected="tab === 'invoice'"
          data-testid="prototype-tab-invoice"
          @click="tab = 'invoice'"
        >
          <Check v-if="tab !== 'invoice'" class="size-3.5 opacity-40" />
          1 · Invoice
        </button>
        <button
          type="button"
          role="tab"
          class="flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            tab === 'voucher'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          "
          :aria-selected="tab === 'voucher'"
          data-testid="prototype-tab-voucher"
          @click="tab = 'voucher'"
        >
          2 · Voucher
        </button>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <PrototypeInvoiceCard v-if="tab === 'invoice'" :data="data" />
        <PrototypeVoucherCard v-else :data="data" />
      </div>

      <div class="shrink-0 space-y-3 border-t pt-3">
        <PrintControls v-model:print-customer-copy="printCustomerCopy" />
        <DialogFooter class="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            v-if="tab === 'invoice'"
            type="button"
            variant="outline"
            data-testid="prototype-next-step"
            @click="tab = 'voucher'"
          >
            Next: Credit Voucher →
          </Button>
          <Button
            v-else
            type="button"
            variant="outline"
            data-testid="prototype-prev-step"
            @click="tab = 'invoice'"
          >
            ← Back to Invoice
          </Button>
          <Button data-testid="prototype-done" @click="open = false">
            <Printer class="mr-2 size-4" />
            Done
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
