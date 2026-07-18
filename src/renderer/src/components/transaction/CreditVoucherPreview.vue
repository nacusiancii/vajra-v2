<script setup lang="ts">
import { computed } from 'vue'
import { Separator } from '@/components/ui/separator'
import { formatQty, formatRupees } from '@/lib/format'

export interface VoucherLine {
  productName: string
  isLoose: boolean
  qty: number
  bagSizeG: number | null
  quintalRate: number | null
  perKgRate: number | null
  lineTotal: number
}

const props = withDefaults(
  defineProps<{
    /**
     * Full transaction ID shared with the Sale Invoice (ADR-0009).
     */
    transactionId: string | null
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
    /** Sale Discount in paise (0 when none). */
    discountAmount: number
    total: number
    /**
     * When true, only the front face is shown and the back is behind a collapsible
     * control (finish-panel layout). When false, front + back are both expanded.
     */
    collapsibleBack?: boolean
  }>(),
  { collapsibleBack: false }
)

const showBack = defineModel<boolean>('showBack', { default: false })

/** Format YYYY-MM-DD → DD/MM/YYYY for the voucher face. */
const displayDate = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.date)
  if (!m) return props.date || '—'
  return `${m[3]}/${m[2]}/${m[1]}`
})

/**
 * Bag lines: qty bags × (bag kg / 100) × Quintal Rate.
 * Loose lines: kg × 1 × price/kg.
 */
const breakdowns = computed(() =>
  props.lines.map((line) => {
    const qty = formatQty(line.qty)
    if (line.isLoose) {
      return {
        productName: line.productName,
        qty,
        ratio: '1',
        price: formatRupees(line.perKgRate ?? 0),
        total: formatRupees(line.lineTotal),
        formula: `${qty} kg × ${formatRupees(line.perKgRate ?? 0)}/kg`
      }
    }
    if (line.bagSizeG) {
      return {
        productName: line.productName,
        qty,
        // bag grams / quintal grams = bag kg / 100
        ratio: formatQty(line.bagSizeG / 100_000),
        price: formatRupees(line.quintalRate ?? 0),
        total: formatRupees(line.lineTotal),
        formula: null as string | null
      }
    }
    return {
      productName: line.productName,
      qty,
      ratio: '1',
      price: formatRupees(0),
      total: formatRupees(line.lineTotal),
      formula: null as string | null
    }
  })
)

const backVisible = computed(() => !props.collapsibleBack || showBack.value)
</script>

<template>
  <div class="space-y-4" data-testid="voucher-preview">
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
        <span class="text-muted-foreground">Transaction ID</span>
        <span class="text-lg font-bold tabular-nums" data-testid="voucher-number">
          {{ transactionId ?? '—' }}
        </span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Date</span>
        <span data-testid="voucher-date">{{ displayDate }}</span>
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
          data-testid="voucher-customer"
          >{{ customerName }}</span
        >
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="shrink-0 text-muted-foreground">Place</span>
        <span
          class="inline-block min-w-[10rem] text-right"
          :class="
            !place.trim() ? 'min-h-[1.25em] border-b border-dashed border-muted-foreground/50' : ''
          "
          data-testid="voucher-place"
          >{{ place }}</span
        >
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

    <button
      v-if="collapsibleBack && !showBack"
      type="button"
      class="w-full rounded-md border border-dashed border-amber-300 px-3 py-2 text-left text-sm text-muted-foreground hover:bg-amber-50/60 dark:border-amber-800 dark:hover:bg-amber-950/40"
      data-testid="voucher-show-back"
      @click="showBack = true"
    >
      Show voucher back (lines)
    </button>

    <!-- Back side: chosen products + charges -->
    <div
      v-if="backVisible"
      class="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-4 text-sm dark:bg-amber-950"
      data-testid="voucher-back"
    >
      <div class="mb-2 flex items-center justify-between gap-2">
        <p
          class="text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Back
        </p>
        <button
          v-if="collapsibleBack"
          type="button"
          class="text-xs text-muted-foreground underline-offset-2 hover:underline"
          data-testid="voucher-hide-back"
          @click="showBack = false"
        >
          Hide
        </button>
      </div>
      <div class="text-center">
        <p class="font-semibold">Chosen Products</p>
        <p class="text-xs text-muted-foreground">bags: qty × ratio × price; loose: kg × price/kg</p>
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
          <span v-if="line.formula">{{ line.formula }}</span>
          <span v-else>{{ line.qty }} × {{ line.ratio }} × {{ line.price }}</span>
          <span class="font-medium text-foreground">= {{ line.total }}</span>
        </p>
      </div>

      <Separator class="my-2" />

      <div v-if="loadingCharges" class="flex justify-between py-0.5" data-testid="voucher-loading">
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
      <div v-if="discountAmount" class="flex justify-between py-0.5" data-testid="voucher-discount">
        <span class="text-muted-foreground">Discount</span>
        <span class="tabular-nums">−{{ formatRupees(discountAmount) }}</span>
      </div>
      <div class="flex justify-between font-semibold" data-testid="voucher-total">
        <span>Total</span>
        <span class="tabular-nums">{{ formatRupees(total) }}</span>
      </div>
    </div>
  </div>
</template>
