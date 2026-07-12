<script setup lang="ts">
/**
 * Settle money breakdown: Goods + opt-in Loading Charge + Additional Charges.
 * Loading Charge is a flat tier from total bulk mass (weight breakpoints).
 */
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatKgFromG, formatRupees } from '@/lib/format'
import { parseRupeesInput, paiseInputValue } from '@/lib/money-input'

const props = defineProps<{
  applyLoading: boolean
  loadingCharge: number
  goodsTotal: number
  additionalCharges: number | null
  /** Total bulk mass in grams for the Loading Charge formula. */
  bulkMassG: number
}>()

const emit = defineEmits<{
  'update:applyLoading': [value: boolean]
  'update:additionalCharges': [value: number | null]
}>()
</script>

<template>
  <div
    class="space-y-1 rounded-lg border bg-muted/20 p-3 text-sm"
    data-testid="settle-receipt-stack"
  >
    <div class="flex items-center justify-between py-1">
      <span class="text-muted-foreground">Goods</span>
      <span class="tabular-nums">{{ formatRupees(props.goodsTotal) }}</span>
    </div>

    <div
      class="rounded-md py-1.5 pl-1 transition-colors"
      :class="props.applyLoading ? 'bg-primary/10' : ''"
      data-testid="sale-apply-loading-label"
    >
      <div class="flex items-start justify-between gap-2">
        <label class="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
          <Checkbox
            class="mt-0.5"
            :model-value="props.applyLoading"
            data-testid="sale-apply-loading"
            @update:model-value="emit('update:applyLoading', $event === true)"
          />
          <span class="min-w-0 flex-1">
            <span class="block">Loading Charge</span>
            <span
              v-if="props.bulkMassG > 0"
              class="mt-0.5 block text-xs text-muted-foreground tabular-nums"
              data-testid="sale-loading-formula"
            >
              {{ formatKgFromG(props.bulkMassG) }} bulk
            </span>
          </span>
        </label>
        <span
          class="shrink-0 tabular-nums"
          :class="props.applyLoading ? 'font-semibold' : 'text-muted-foreground'"
          data-testid="sale-loading-amount"
        >
          {{ props.applyLoading ? formatRupees(props.loadingCharge) : '—' }}
        </span>
      </div>
    </div>

    <div class="flex items-center justify-between gap-3 py-1">
      <Label class="text-muted-foreground">Additional Charges</Label>
      <Input
        type="number"
        min="0"
        class="h-8 w-28 text-right tabular-nums"
        :model-value="paiseInputValue(props.additionalCharges)"
        placeholder="0"
        data-testid="sale-additional"
        @update:model-value="emit('update:additionalCharges', parseRupeesInput($event))"
      />
    </div>
  </div>
</template>
