<script setup lang="ts">
import { Separator } from '@/components/ui/separator'
import { formatBagKg, formatKgFromG, formatQty, formatRupees } from '@/lib/format'
import { lineMassGrams } from '@domain/transaction-rules'
import type { PrototypeCreditFinish } from './mockData'

defineProps<{
  data: PrototypeCreditFinish
  compact?: boolean
}>()
</script>

<template>
  <div
    class="rounded-md border bg-card p-4 text-sm"
    :class="compact ? 'p-3' : 'p-4'"
    data-testid="prototype-sale-invoice"
  >
    <div class="text-center">
      <p class="font-semibold">అమ్మకం రసీదు</p>
      <p class="text-xs uppercase tracking-widest text-muted-foreground">Sale Invoice</p>
    </div>
    <div class="mt-2 flex items-center justify-between">
      <span class="text-muted-foreground">Sale No.</span>
      <span class="text-lg font-bold tabular-nums" data-testid="prototype-sale-number">{{
        data.saleSeq
      }}</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-muted-foreground">Customer</span>
      <span>{{ data.customerName }}</span>
    </div>
    <div class="flex items-center justify-between text-muted-foreground">
      <span>Place</span>
      <span>{{ data.place }}</span>
    </div>
    <Separator class="my-2" />
    <div
      v-for="line in data.lines"
      :key="line.id"
      class="flex justify-between gap-2 py-0.5"
      data-testid="prototype-invoice-line"
    >
      <span class="truncate">
        {{ line.productName }}
        <span v-if="line.isLoose" class="text-muted-foreground">
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
      v-if="data.loadingCharges"
      class="flex justify-between text-muted-foreground"
      data-testid="prototype-invoice-loading"
    >
      <span>Loading</span>
      <span class="tabular-nums">{{ formatRupees(data.loadingCharges) }}</span>
    </div>
    <div v-if="data.additionalCharges" class="flex justify-between text-muted-foreground">
      <span>Additional</span>
      <span class="tabular-nums">{{ formatRupees(data.additionalCharges) }}</span>
    </div>
    <div class="flex justify-between font-semibold">
      <span>Total</span>
      <span class="tabular-nums" data-testid="prototype-invoice-total">{{
        formatRupees(data.total)
      }}</span>
    </div>
    <div class="mt-1 flex justify-between text-xs text-muted-foreground">
      <span>Pairs with Credit Voucher</span>
      <span class="tabular-nums">#{{ data.voucherSeq }}</span>
    </div>
  </div>
</template>
