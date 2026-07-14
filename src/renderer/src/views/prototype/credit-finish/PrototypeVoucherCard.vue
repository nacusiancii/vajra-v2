<script setup lang="ts">
import { computed } from 'vue'
import { Separator } from '@/components/ui/separator'
import { formatQty, formatRupees } from '@/lib/format'
import { displayDate, type PrototypeCreditFinish } from './mockData'

const props = defineProps<{
  data: PrototypeCreditFinish
  /** Show only front, only back, or both (default). */
  face?: 'front' | 'back' | 'both'
  compact?: boolean
}>()

const face = computed(() => props.face ?? 'both')

const breakdowns = computed(() =>
  props.data.lines.map((line) => {
    const qty = formatQty(line.qty)
    if (line.isLoose) {
      return {
        productName: line.productName,
        qty,
        ratio: '1',
        price: formatRupees(line.perKgRate ?? 0),
        total: formatRupees(line.lineTotal),
        formula: `${qty} kg × ${formatRupees(line.perKgRate ?? 0)}/kg` as string | null
      }
    }
    if (line.bagSizeG) {
      return {
        productName: line.productName,
        qty,
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
</script>

<template>
  <div class="space-y-3 text-sm" data-testid="prototype-credit-voucher">
    <div
      v-if="face === 'front' || face === 'both'"
      class="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-4 dark:bg-amber-950"
      :class="compact ? 'p-3' : 'p-4'"
      data-testid="prototype-voucher-front"
    >
      <p
        class="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Front
      </p>
      <div class="text-center">
        <p class="text-base font-semibold">{{ data.companyName }}</p>
        <p class="mt-1 font-semibold">క్రెడిట్ వోచర్</p>
        <p class="text-xs uppercase tracking-widest text-muted-foreground">Credit Voucher</p>
      </div>
      <Separator class="my-2" />
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Voucher No.</span>
        <span class="text-lg font-bold tabular-nums" data-testid="prototype-voucher-number">{{
          data.voucherSeq
        }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Date</span>
        <span>{{ displayDate(data.date) }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Customer</span>
        <span>{{ data.customerName }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Place</span>
        <span>{{ data.place }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Mobile</span>
        <span class="tabular-nums">{{ data.phone }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-muted-foreground">Amount</span>
        <span class="font-semibold tabular-nums">{{ formatRupees(data.total) }}</span>
      </div>
      <p class="mt-3 border-t pt-3 text-xs text-muted-foreground">
        Customer signature: ____________________
      </p>
    </div>

    <div
      v-if="face === 'back' || face === 'both'"
      class="rounded-md border-2 border-dashed border-amber-400 bg-amber-50 p-4 dark:bg-amber-950"
      :class="compact ? 'p-3' : 'p-4'"
      data-testid="prototype-voucher-back"
    >
      <p
        class="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
      >
        Back
      </p>
      <div class="text-center">
        <p class="font-semibold">Chosen Products</p>
        <p class="text-xs text-muted-foreground">bags: qty × ratio × price; loose: kg × price/kg</p>
      </div>
      <Separator class="my-2" />
      <div
        v-for="(line, idx) in breakdowns"
        :key="idx"
        class="space-y-0.5 border-b border-dashed border-amber-300/60 py-1.5 last:border-0 dark:border-amber-800/60"
      >
        <p class="truncate font-medium">{{ line.productName }}</p>
        <p class="flex flex-wrap justify-between gap-x-2 tabular-nums text-muted-foreground">
          <span v-if="line.formula">{{ line.formula }}</span>
          <span v-else>{{ line.qty }} × {{ line.ratio }} × {{ line.price }}</span>
          <span class="font-medium text-foreground">= {{ line.total }}</span>
        </p>
      </div>
      <Separator class="my-2" />
      <div v-if="data.loadingCharges" class="flex justify-between py-0.5">
        <span class="text-muted-foreground">Loading Charges</span>
        <span class="tabular-nums">{{ formatRupees(data.loadingCharges) }}</span>
      </div>
      <div class="flex justify-between font-semibold">
        <span>Total</span>
        <span class="tabular-nums">{{ formatRupees(data.total) }}</span>
      </div>
    </div>
  </div>
</template>
