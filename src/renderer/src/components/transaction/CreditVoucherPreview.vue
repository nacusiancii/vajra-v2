<script setup lang="ts">
import { computed } from 'vue'
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
import type { ProductType } from '@domain/types'

export interface VoucherLine {
  productName: string
  productType: ProductType
  isLoose: boolean
  qty: number
  bagSizeG: number | null
  quintalRate: number | null
  unitRate: number | null
  lineTotal: number
}

const props = defineProps<{
  open: boolean
  voucherSeq: number | null
  companyName: string
  /** Business Day date as YYYY-MM-DD. */
  date: string
  customerName: string
  place: string
  /** Customer mobile (required for Credit Sales). */
  phone: string
  amount: number
  lines: VoucherLine[]
  loadingCharges: number
  additionalCharges: number
  total: number
}>()

defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

/** Format YYYY-MM-DD → DD/MM/YYYY for the voucher face. */
const displayDate = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.date)
  if (!m) return props.date || '—'
  return `${m[3]}/${m[2]}/${m[1]}`
})

/**
 * Bagged bulk: qty bags × (bag kg / 100) × Quintal Rate.
 * Loose bulk / packaged: qty × 1 × unit rate (₹/kg or ₹/unit).
 */
const breakdowns = computed(() =>
  props.lines.map((line) => {
    const qty = formatQty(line.qty)
    if (line.productType === 'bulk' && !line.isLoose && line.bagSizeG) {
      return {
        productName: line.productName,
        qty,
        // bag grams / quintal grams = bag kg / 100
        ratio: formatQty(line.bagSizeG / 100_000),
        price: formatRupees(line.quintalRate ?? 0),
        total: formatRupees(line.lineTotal)
      }
    }
    return {
      productName: line.productName,
      qty,
      ratio: '1',
      price: formatRupees(line.unitRate ?? 0),
      total: formatRupees(line.lineTotal)
    }
  })
)
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg" data-testid="voucher-preview">
      <DialogHeader>
        <DialogTitle>Credit Voucher</DialogTitle>
        <DialogDescription>
          Hand this to the customer to sign. Reprinting after a price change issues a new Voucher
          Number.
        </DialogDescription>
      </DialogHeader>

      <div class="max-h-[70vh] space-y-4 overflow-y-auto">
        <!-- Front side: identity + amount for signature -->
        <div
          class="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm dark:bg-amber-950"
          data-testid="voucher-front"
        >
          <p
            class="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Front
          </p>
          <div class="text-center">
            <p class="text-base font-semibold" data-testid="voucher-company">
              {{ companyName.trim() || '—' }}
            </p>
            <p class="mt-1 font-semibold">క్రెడిట్ వోచర్</p>
            <p class="text-xs uppercase tracking-widest text-muted-foreground">Credit Voucher</p>
          </div>
          <Separator class="my-2" />
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Voucher No.</span>
            <span class="text-lg font-bold tabular-nums" data-testid="voucher-number">
              {{ voucherSeq }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Date</span>
            <span data-testid="voucher-date">{{ displayDate }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Customer</span>
            <span data-testid="voucher-customer">{{ customerName }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Place</span>
            <span data-testid="voucher-place">{{ place.trim() || '—' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Mobile</span>
            <span class="tabular-nums" data-testid="voucher-phone">{{ phone.trim() || '—' }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-muted-foreground">Amount</span>
            <span class="font-semibold tabular-nums" data-testid="voucher-amount">{{
              formatRupees(amount)
            }}</span>
          </div>
          <p class="mt-3 border-t pt-3 text-xs text-muted-foreground">
            Customer signature: ____________________
          </p>
        </div>

        <!-- Back side: chosen products + charges -->
        <div
          class="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm dark:bg-amber-950"
          data-testid="voucher-back"
        >
          <p
            class="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Back
          </p>
          <div class="text-center">
            <p class="font-semibold">Chosen Products</p>
            <p class="text-xs text-muted-foreground">qty × ratio × price = line total</p>
          </div>
          <Separator class="my-2" />

          <div
            v-for="(line, idx) in breakdowns"
            :key="idx"
            class="space-y-0.5 border-b border-dashed border-amber-300/60 py-1.5 last:border-0 dark:border-amber-800/60"
            data-testid="voucher-line"
          >
            <p class="truncate font-medium">{{ line.productName }}</p>
            <p class="flex flex-wrap justify-between gap-x-2 tabular-nums text-muted-foreground">
              <span>{{ line.qty }} × {{ line.ratio }} × {{ line.price }}</span>
              <span class="font-medium text-foreground">= {{ line.total }}</span>
            </p>
          </div>

          <Separator class="my-2" />

          <div
            v-if="loadingCharges"
            class="flex justify-between py-0.5"
            data-testid="voucher-loading"
          >
            <span class="text-muted-foreground">Loading Charges</span>
            <span class="tabular-nums">{{ formatRupees(loadingCharges) }}</span>
          </div>
          <div
            v-if="additionalCharges"
            class="flex justify-between py-0.5"
            data-testid="voucher-additional"
          >
            <span class="text-muted-foreground">Additional Charges</span>
            <span class="tabular-nums">{{ formatRupees(additionalCharges) }}</span>
          </div>
          <div class="flex justify-between font-semibold" data-testid="voucher-total">
            <span>Total</span>
            <span class="tabular-nums">{{ formatRupees(total) }}</span>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button data-testid="voucher-preview-done" @click="$emit('done')">Done</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
