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
import { formatQty, formatRupees } from '@/lib/format'
import { QUINTAL_G } from '@domain/units'
import type { Txn } from '@domain/transaction'

const props = withDefaults(
  defineProps<{
    open: boolean
    txn: Txn | null
    /** When true the slip would be hand-copied (Printerless Mode, ADR-0008). */
    printerless: boolean
    /**
     * Customer-facing counterparty name (ADR-0003): Telugu for master when set,
     * blank handwriting gap when missing; walk-in English as stored.
     */
    customerName?: string
    /**
     * Customer-facing place (ADR-0003): Telugu for master when set, blank when missing;
     * walk-in English place as stored.
     */
    place?: string
    /**
     * Counterparty phone when known. Blank when absent (same as Credit Voucher).
     */
    phone?: string
    /**
     * productId → customer-face product name (Telugu preferred, English fallback).
     * Lines fall back to ledger English productName when an id is absent.
     */
    productFaceNames?: Record<number, string>
    /**
     * Extra customer copy of the Sale Invoice (ADR-0008). Default on → two copies.
     */
    printCustomerCopy?: boolean
  }>(),
  {
    customerName: '',
    place: '',
    phone: '',
    productFaceNames: () => ({}),
    printCustomerCopy: true
  }
)

defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

const isCredit = computed(() => props.txn?.saleMode === 'credit')

function lineProductName(productId: number, englishName: string): string {
  return props.productFaceNames[productId] || englishName
}

/** Business + customer when opted in; business only when the cashier opts out. */
const copyCount = computed(() => (props.printCustomerCopy ? 2 : 1))
const copyLabel = computed(() =>
  props.printCustomerCopy ? '2 copies (business + customer)' : '1 copy (business only)'
)
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
          <span class="mt-1 block" data-testid="slip-copy-count">{{ copyLabel }}</span>
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
            <span class="text-muted-foreground">Transaction ID</span>
            <span class="text-lg font-bold tabular-nums" data-testid="sale-number">{{
              txn.id
            }}</span>
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="shrink-0 text-muted-foreground">Customer</span>
            <!-- ADR-0003: blank handwriting gap when master Telugu name is missing -->
            <span
              class="inline-block min-w-[10rem] text-right"
              :class="
                !customerName.trim()
                  ? 'min-h-[1.25em] border-b border-dashed border-muted-foreground/50'
                  : ''
              "
              data-testid="slip-customer"
              >{{ customerName }}</span
            >
          </div>
          <div class="flex items-center justify-between gap-3">
            <span class="shrink-0 text-muted-foreground">Place</span>
            <span
              class="inline-block min-w-[10rem] text-right"
              :class="
                !place.trim()
                  ? 'min-h-[1.25em] border-b border-dashed border-muted-foreground/50'
                  : ''
              "
              data-testid="slip-place"
              >{{ place }}</span
            >
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Phone</span>
            <span class="tabular-nums" data-testid="slip-phone">{{ phone.trim() || '—' }}</span>
          </div>
          <div
            class="flex items-center justify-between text-muted-foreground"
            data-testid="slip-copies"
          >
            <span>Copies</span>
            <span class="tabular-nums">{{ copyCount }}</span>
          </div>
          <Separator class="my-2" />
          <div v-for="line in txn.lines" :key="line.id" class="flex justify-between gap-2 py-0.5">
            <span class="truncate" data-testid="slip-line-product">
              {{ lineProductName(line.productId, line.productName) }}
              <!--
                Bag: Quantity × Weight (Quintals) × Quintal Rate
                Loose: kg × price/kg (CONTEXT.md / #132)
              -->
              <span v-if="line.isLoose" class="text-muted-foreground" data-testid="slip-line-loose">
                ({{ formatQty(line.qty) }} kg × {{ formatRupees(line.perKgRate ?? 0) }}/kg)
              </span>
              <span
                v-else-if="line.bagSizeG"
                class="text-muted-foreground"
                data-testid="slip-line-bag"
              >
                ({{ formatQty(line.qty) }} × {{ formatQty(line.bagSizeG / QUINTAL_G) }} ×
                {{ formatRupees(line.quintalRate ?? 0) }})
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
          <div
            v-if="txn.discountAmount"
            class="flex justify-between text-muted-foreground"
            data-testid="slip-discount"
          >
            <span>Discount</span
            ><span class="tabular-nums">−{{ formatRupees(txn.discountAmount) }}</span>
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
            <span class="tabular-nums" data-testid="slip-voucher-id">{{ txn.id }}</span>
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
