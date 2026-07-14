<script setup lang="ts">
/**
 * Variant A — Side-by-side equal columns (Invoice | Voucher).
 * Shared footer: print toggles + Done. Both previews fully visible at once.
 */
import { ref } from 'vue'
import { Printer } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import PrototypeInvoiceCard from './PrototypeInvoiceCard.vue'
import PrototypeVoucherCard from './PrototypeVoucherCard.vue'
import PrintControls from './PrintControls.vue'
import type { PrototypeCreditFinish } from './mockData'

defineProps<{ data: PrototypeCreditFinish }>()

const open = ref(true)
const printCustomerCopy = ref(true)

defineExpose({ name: 'Side-by-side equal columns' })
</script>

<template>
  <Dialog :open="open" @update:open="(v) => (open = v)">
    <DialogContent
      class="flex max-h-[90vh] w-full flex-col gap-3 sm:max-w-5xl"
      data-testid="prototype-variant-a"
      :show-close-button="true"
    >
      <DialogHeader class="shrink-0">
        <DialogTitle>
          {{ data.printerless ? 'Write manual copies' : 'Credit Sale finish' }}
        </DialogTitle>
        <DialogDescription>
          Two artifacts side by side — Sale Invoice and Credit Voucher. Sale No.
          {{ data.saleSeq }} · Voucher No. {{ data.voucherSeq }}.
          {{
            data.printerless
              ? 'Printerless Mode — copy both by hand.'
              : 'Both queue to print by default.'
          }}
        </DialogDescription>
      </DialogHeader>

      <div class="min-h-0 flex-1 overflow-y-auto">
        <!-- Always two columns so screenshots/narrow Electron viewports still show dual panels. -->
        <div class="grid grid-cols-2 gap-4">
          <section class="space-y-2">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sale Invoice
            </h3>
            <PrototypeInvoiceCard :data="data" />
          </section>
          <section class="space-y-2">
            <h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Credit Voucher
            </h3>
            <div class="max-h-[52vh] overflow-y-auto pr-1">
              <PrototypeVoucherCard :data="data" />
            </div>
          </section>
        </div>
      </div>

      <div class="shrink-0 space-y-3 border-t pt-3">
        <PrintControls v-model:print-customer-copy="printCustomerCopy" />
        <DialogFooter>
          <Button data-testid="prototype-done" @click="open = false">
            <Printer class="mr-2 size-4" />
            Done
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>
