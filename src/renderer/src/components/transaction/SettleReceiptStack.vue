<script setup lang="ts">
/**
 * Settle money breakdown: Goods + opt-in Loading Charge + Additional Charges.
 * Loading Charge is a line item in the total story, not a free-floating checkbox.
 */
import { computed } from 'vue'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatRupees } from '@/lib/format'
import { formatLoadingFormula, type LoadingBagBucket } from './loading-buckets'

const props = defineProps<{
  applyLoading: boolean
  loadingCharge: number
  goodsTotal: number
  additionalCharges: number | null
  buckets: LoadingBagBucket[]
}>()

const emit = defineEmits<{
  'update:applyLoading': [value: boolean]
  'update:additionalCharges': [value: number | null]
}>()

const loadingFormula = computed(() => formatLoadingFormula(props.buckets))
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
      class="flex items-center justify-between gap-2 rounded-md py-1.5 pl-1 transition-colors"
      :class="props.applyLoading ? 'bg-primary/10' : ''"
      data-testid="sale-apply-loading-label"
    >
      <label class="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
        <Checkbox
          :model-value="props.applyLoading"
          data-testid="sale-apply-loading"
          @update:model-value="emit('update:applyLoading', $event === true)"
        />
        <span class="truncate">
          Loading Charge
          <span
            v-if="loadingFormula"
            class="text-xs text-muted-foreground"
            data-testid="sale-loading-formula"
          >
            ({{ loadingFormula }})
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

    <div class="flex items-center justify-between gap-3 py-1">
      <Label class="text-muted-foreground">Additional Charges</Label>
      <Input
        type="number"
        min="0"
        class="h-8 w-28 text-right tabular-nums"
        :model-value="props.additionalCharges ?? ''"
        placeholder="0"
        data-testid="sale-additional"
        @update:model-value="
          emit('update:additionalCharges', $event === '' ? null : Number($event))
        "
      />
    </div>
  </div>
</template>
