<script setup lang="ts">
import { computed } from 'vue'
import { Printer } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatBagKg, formatKgFromG, formatQty, formatRupees } from '@/lib/format'
import { lineMassGrams } from '@domain/transaction-rules'
import type { Txn } from '@domain/transaction'

const props = defineProps<{
  open: boolean
  txn: Txn | null
  /** When true the slip would be hand-copied (Printerless Mode, ADR-0008). */
  printerless: boolean
}>()

defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

const isCredit = computed(() => props.txn?.saleMode === 'credit')
const counterparty = computed(() => {
  const t = props.txn
  if (!t) return ''
  return t.customerName ?? t.walkinName ?? 'Walk in'
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md" data-testid="slip-preview">
      <DialogHeader>
        <DialogTitle>
          {{ printerless ? 'Write a manual copy' : 'Slip preview' }}
        </DialogTitle>
        <DialogDescription>
          {{
            printerless
              ? 'Printerless Mode is on — copy these details by hand.'
              : 'This is what would print. (Printing is preview-only in this build.)'
          }}
        </DialogDescription>
      </DialogHeader>

      <div v-if="txn" class="space-y-4">
        <!-- Sale Invoice -->
        <div class="rounded-md border bg-card p-4 text-sm" data-testid="sale-invoice">
          <div class="text-center">
            <p class="font-semibold">అమ్మకం రసీదు</p>
            <p class="text-xs uppercase tracking-widest text-muted-foreground">Sale Invoice</p>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-muted-foreground">Sale No.</span>
            <span class="text-lg font-bold tabular-nums" data-testid="sale-number">{{
              txn.seq
            }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Customer</span>
            <span>{{ counterparty }}</span>
          </div>
          <Separator class="my-2" />
          <div v-for="line in txn.lines" :key="line.id" class="flex justify-between gap-2 py-0.5">
            <span class="truncate">
              {{ line.productName }}
              <span v-if="line.isLoose" class="text-muted-foreground" data-testid="slip-line-loose">
                ({{ formatQty(line.qty) }} kg × {{ formatRupees(line.perKgRate ?? 0) }}/kg)
              </span>
              <span v-else-if="line.bagSizeG" class="text-muted-foreground">
                ({{ formatQty(line.qty) }} × {{ formatBagKg(line.bagSizeG) }} =
                {{
                  formatKgFromG(
                    lineMassGrams({ isLoose: false, qty: line.qty, bagSizeG: line.bagSizeG })
                  )
                }})
              </span>
              <span v-else class="text-muted-foreground">× {{ formatQty(line.qty) }}</span>
            </span>
            <span class="tabular-nums">{{ formatRupees(line.lineTotal) }}</span>
          </div>
          <Separator class="my-2" />
          <div
            v-if="txn.loadingCharges"
            class="flex justify-between text-muted-foreground"
            data-testid="slip-loading"
          >
            <span>Loading</span
            ><span class="tabular-nums">{{ formatRupees(txn.loadingCharges) }}</span>
          </div>
          <div v-if="txn.additionalCharges" class="flex justify-between text-muted-foreground">
            <span>Additional</span
            ><span class="tabular-nums">{{ formatRupees(txn.additionalCharges) }}</span>
          </div>
          <div class="flex justify-between font-semibold">
            <span>Total</span><span class="tabular-nums">{{ formatRupees(txn.total) }}</span>
          </div>
          <template v-if="!isCredit">
            <div v-if="txn.cashIn" class="flex justify-between text-muted-foreground">
              <span>Cash</span><span class="tabular-nums">{{ formatRupees(txn.cashIn) }}</span>
            </div>
            <div v-if="txn.upiIn" class="flex justify-between text-muted-foreground">
              <span>UPI</span><span class="tabular-nums">{{ formatRupees(txn.upiIn) }}</span>
            </div>
          </template>
          <div v-else class="flex justify-between text-muted-foreground">
            <span>Credit Voucher</span>
            <span class="tabular-nums">#{{ txn.voucherSeq }}</span>
          </div>
          <div v-if="txn.remarks" class="mt-2 border-t pt-2" data-testid="slip-remarks">
            <p class="text-muted-foreground">Remarks</p>
            <p class="whitespace-pre-wrap">{{ txn.remarks }}</p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button data-testid="slip-done" @click="$emit('done')">
          <Printer class="mr-2 size-4" />
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
