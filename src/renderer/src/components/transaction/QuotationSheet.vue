<script setup lang="ts">
import { formatQty, formatRupees, formatSlipDate } from '@/lib/format'
import { QUINTAL_G } from '@domain/units'
import type { Txn } from '@domain/transaction'

/**
 * The Quotation as it lands on paper: a 10 cm × 21 cm upright sheet (ADR-0012).
 * The same component is the on-screen preview and the PDF page, so screen and
 * paper can't drift. Black on white in both themes — it is paper.
 *
 * Customer-face strings arrive already resolved (Telugu first, ADR-0003).
 */
const props = withDefaults(
  defineProps<{
    txn: Txn
    companyName?: string
    /** Business Day date as YYYY-MM-DD. */
    date?: string
    customerName?: string
    place?: string
    phone?: string
    /** productId → customer-face product name; falls back to the ledger English name. */
    productFaceNames?: Record<number, string>
  }>(),
  {
    companyName: '',
    date: '',
    customerName: '',
    place: '',
    phone: '',
    productFaceNames: () => ({})
  }
)

function lineProductName(productId: number, englishName: string): string {
  return props.productFaceNames[productId] || englishName
}
</script>

<template>
  <div class="quotation-sheet bg-white p-[6mm] text-[11px] leading-snug text-black">
    <div class="flex items-start justify-between gap-2">
      <span>
        S.No <span class="font-semibold tabular-nums" data-testid="sale-number">{{ txn.id }}</span>
      </span>
      <span class="shrink-0 tabular-nums">Dt. {{ formatSlipDate(date) }}</span>
    </div>
    <div class="my-2 text-center">
      <p v-if="companyName.trim()" class="text-base font-bold" data-testid="slip-company">
        {{ companyName }}
      </p>
      <p class="text-xs font-semibold tracking-widest">QUOTATION</p>
    </div>
    <div class="flex justify-between gap-2">
      <span>కొనుగోలుదారు</span>
      <span class="text-right font-semibold" data-testid="slip-customer">{{ customerName }}</span>
    </div>
    <div class="flex justify-between gap-2">
      <span>గ్రామం</span>
      <span class="text-right" data-testid="slip-place">{{ place.trim() || '—' }}</span>
    </div>
    <div class="flex justify-between gap-2">
      <span>Ph.No</span>
      <span class="tabular-nums" data-testid="slip-phone">{{ phone.trim() || '—' }}</span>
    </div>

    <div class="my-2 border-t border-black" />

    <div v-for="line in txn.lines" :key="line.id" class="flex justify-between gap-2 py-0.5">
      <span data-testid="slip-line-product">
        {{ lineProductName(line.productId, line.productName) }}
        <!-- Bag: bags × quintals per bag × Quintal Rate. Loose: kg × price/kg. -->
        <span v-if="line.isLoose" class="block tabular-nums" data-testid="slip-line-loose">
          ({{ formatQty(line.qty) }} kg × {{ formatRupees(line.perKgRate ?? 0) }}/kg)
        </span>
        <span v-else-if="line.bagSizeG" class="block tabular-nums" data-testid="slip-line-bag">
          ({{ formatQty(line.qty) }} × {{ formatQty(line.bagSizeG / QUINTAL_G) }} ×
          {{ formatRupees(line.quintalRate ?? 0) }})
        </span>
      </span>
      <span class="shrink-0 tabular-nums">{{ formatRupees(line.lineTotal) }}</span>
    </div>

    <div class="my-2 border-t border-black" />

    <div v-if="txn.loadingCharges" class="flex justify-between" data-testid="slip-loading">
      <span>Loading</span><span class="tabular-nums">{{ formatRupees(txn.loadingCharges) }}</span>
    </div>
    <div v-if="txn.additionalCharges" class="flex justify-between">
      <span>Additional</span
      ><span class="tabular-nums">{{ formatRupees(txn.additionalCharges) }}</span>
    </div>
    <div v-if="txn.discountAmount" class="flex justify-between" data-testid="slip-discount">
      <span>Discount</span><span class="tabular-nums">−{{ formatRupees(txn.discountAmount) }}</span>
    </div>
    <div class="flex justify-between text-sm font-bold">
      <span>Total</span><span class="tabular-nums">{{ formatRupees(txn.total) }}</span>
    </div>
    <template v-if="txn.saleMode !== 'credit'">
      <div v-if="txn.cashIn" class="flex justify-between">
        <span>Cash</span><span class="tabular-nums">{{ formatRupees(txn.cashIn) }}</span>
      </div>
      <div v-if="txn.upiIn" class="flex justify-between">
        <span>UPI</span><span class="tabular-nums">{{ formatRupees(txn.upiIn) }}</span>
      </div>
    </template>
    <div v-else class="flex justify-between">
      <span>Credit Voucher</span>
      <span class="tabular-nums" data-testid="slip-voucher-id">{{ txn.id }}</span>
    </div>

    <div v-if="txn.remarks" class="mt-2 border-t border-black pt-2" data-testid="slip-remarks">
      <p>Remarks</p>
      <p class="whitespace-pre-wrap">{{ txn.remarks }}</p>
    </div>
  </div>
</template>

<style scoped>
/* Paper size: 10 cm wide × 21 cm tall, upright (ADR-0012). */
.quotation-sheet {
  width: 100mm;
  min-height: 210mm;
  box-sizing: border-box;
}
</style>
