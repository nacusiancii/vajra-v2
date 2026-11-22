<script setup lang="ts">
import { computed } from 'vue'
import CreditVoucherSheet, { type VoucherLine } from './CreditVoucherSheet.vue'

export type { VoucherLine }

/**
 * On-screen Credit Voucher: the same sheets that print (ADR-0012), front first,
 * back behind a toggle on the finish panel.
 */
const props = withDefaults(
  defineProps<{
    transactionId: string | null
    companyName: string
    /** Business Day date as YYYY-MM-DD. */
    date: string
    customerName: string
    place: string
    /** Customer mobile (required for Credit Sales). */
    phone: string
    lines: VoucherLine[]
    loadingCharges: number
    additionalCharges: number
    /** Sale Discount in paise (0 when none). */
    discountAmount: number
    total: number
    upiId?: string
    interestPaisePer100?: number
    /** When true, the back is behind a toggle (finish-panel layout). */
    collapsibleBack?: boolean
  }>(),
  { upiId: '', interestPaisePer100: 200, collapsibleBack: false }
)

const showBack = defineModel<boolean>('showBack', { default: false })

const backVisible = computed(() => !props.collapsibleBack || showBack.value)

const sheetProps = computed(() => ({
  transactionId: props.transactionId,
  companyName: props.companyName,
  date: props.date,
  customerName: props.customerName,
  place: props.place,
  phone: props.phone,
  lines: props.lines,
  loadingCharges: props.loadingCharges,
  additionalCharges: props.additionalCharges,
  discountAmount: props.discountAmount,
  total: props.total,
  upiId: props.upiId,
  interestPaisePer100: props.interestPaisePer100
}))
</script>

<template>
  <div class="space-y-4" data-testid="voucher-preview">
    <div class="overflow-x-auto rounded-md border bg-white">
      <CreditVoucherSheet side="front" class="mx-auto" v-bind="sheetProps" />
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

    <div v-if="backVisible" class="space-y-1">
      <div v-if="collapsibleBack" class="flex justify-end">
        <button
          type="button"
          class="text-xs text-muted-foreground underline-offset-2 hover:underline"
          data-testid="voucher-hide-back"
          @click="showBack = false"
        >
          Hide back
        </button>
      </div>
      <div class="overflow-x-auto rounded-md border bg-white">
        <CreditVoucherSheet side="back" class="mx-auto" v-bind="sheetProps" />
      </div>
    </div>
  </div>
</template>
