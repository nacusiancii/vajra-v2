<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, RefreshCcw, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import EntityCombobox, { type ComboboxOption } from '@/components/EntityCombobox.vue'
import { useProductsQuery } from '@/queries/products'
import { useCreateStockTransfer, useEditStockTransfer } from '@/queries/transactions'
import {
  lineKg,
  suggestedTransferTargetQty,
  validateTransferLeg,
  type LineProductLookup
} from '@domain/transaction-rules'
import { formatQty } from '@/lib/format'
import type { CreateStockTransferInput, TransferLegInput } from '@domain/transaction'

interface LegRow {
  productId: number | null
  bagSizeKg: number | null
  qty: number | null
}

const emptyLeg = (): LegRow => ({ productId: null, bagSizeKg: null, qty: null })

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const createTransfer = useCreateStockTransfer()
const editTransfer = useEditStockTransfer()

/** One source product out, one target product in. */
const source = ref<LegRow>(emptyLeg())
const target = ref<LegRow>(emptyLeg())
const remarks = ref('')
const error = ref<string | null>(null)
/** True after a manual target-qty edit; blocks auto-fill until target product changes. */
const targetQtyDirty = ref(false)
const targetQtySuggested = ref(false)

const productList = computed(() => products.value ?? [])
const productMap = computed(() => new Map(productList.value.map((p) => [p.id, p])))
const productOptions = computed<ComboboxOption[]>(() =>
  productList.value.map((p) => ({ value: p.id, label: p.name, hint: p.type }))
)

const productLookup = computed(() => {
  const map = new Map<number, LineProductLookup>()
  for (const p of productList.value)
    map.set(p.id, { type: p.type, defaultBagSizeKg: p.defaultBagSizeKg })
  return map
})

function isBulk(leg: LegRow): boolean {
  return leg.productId != null && productMap.value.get(leg.productId)?.type === 'bulk'
}

function rowKg(leg: LegRow): number {
  const p = leg.productId == null ? undefined : productMap.value.get(leg.productId)
  if (!p || !leg.qty) return 0
  return lineKg(p.type, leg.qty, leg.bagSizeKg)
}

const sourceKg = computed(() => rowKg(source.value))
const targetKg = computed(() => rowKg(target.value))

/** Suggested target bags from current source kg, if computable. */
const suggestedTargetQty = computed(() => {
  const p =
    target.value.productId == null ? undefined : productMap.value.get(target.value.productId)
  if (!p || p.type !== 'bulk') return null
  return suggestedTransferTargetQty(sourceKg.value, p.defaultBagSizeKg)
})

/** Show re-suggest when a suggestion exists and target qty is not already that value. */
const canResuggestTargetQty = computed(() => {
  const suggested = suggestedTargetQty.value
  if (suggested == null) return false
  return target.value.qty !== suggested
})

function parseQty(value: string | number): number | null {
  return value === '' ? null : Number(value)
}

function markTargetQtyManual(): void {
  targetQtyDirty.value = true
  targetQtySuggested.value = false
}

function resumeTargetQtySuggestion(): void {
  targetQtyDirty.value = false
  applySuggestedTargetQty()
}

function onProduct(leg: LegRow, value: number | null, side: 'source' | 'target'): void {
  leg.productId = value
  const p = value == null ? undefined : productMap.value.get(value)
  // Stock Transfers always move Default-Bag-Size bags — no per-leg bag choice.
  leg.bagSizeKg = p?.type === 'bulk' ? (p.defaultBagSizeKg ?? null) : null
  if (side === 'target') resumeTargetQtySuggestion()
}

function onQtyInput(leg: LegRow, value: string | number, side: 'source' | 'target'): void {
  leg.qty = parseQty(value)
  if (side === 'target') markTargetQtyManual()
}

/**
 * Fill target qty as sourceKg ÷ target Default Bag Size.
 * No-op when the cashier has overridden qty or kg is not computable.
 */
function applySuggestedTargetQty(): void {
  if (targetQtyDirty.value) {
    targetQtySuggested.value = false
    return
  }
  const suggested = suggestedTargetQty.value
  if (suggested == null) {
    targetQtySuggested.value = false
    return
  }
  target.value.qty = suggested
  targetQtySuggested.value = true
}

function toLegInput(leg: LegRow): TransferLegInput | null {
  if (leg.productId == null) return null
  return { productId: leg.productId, bagSizeKg: leg.bagSizeKg, qty: leg.qty ?? 0 }
}

function buildInput(): CreateStockTransferInput {
  const src = toLegInput(source.value)
  const tgt = toLegInput(target.value)
  return {
    source: src ? [src] : [],
    target: tgt ? [tgt] : [],
    remarks: remarks.value.trim() || null
  }
}

function finish(): void {
  error.value = null
  const input = buildInput()
  if (input.source.length === 0 || input.target.length === 0) {
    error.value = 'A Stock Transfer needs a source and a target product'
    return
  }
  for (const leg of [...input.source, ...input.target]) {
    const reason = validateTransferLeg(leg, productLookup.value.get(leg.productId))
    if (reason) {
      error.value = reason
      return
    }
  }
  const onSuccess = (): void => void router.push('/')
  if (editId.value) editTransfer.mutate({ id: editId.value, input }, { onSuccess })
  else createTransfer.mutate(input, { onSuccess })
}

watch(sourceKg, () => applySuggestedTargetQty())

watch(
  editId,
  async () => {
    if (!editId.value) return
    const txn = await window.api.getTransaction(editId.value)
    if (!txn || txn.type !== 'ST') return
    // Preserve saved target qty: mark dirty before source write so the watcher cannot overwrite.
    markTargetQtyManual()
    const first = (side: 'source' | 'target'): LegRow => {
      const line = txn.lines.find((l) => l.side === side)
      return line
        ? { productId: line.productId, bagSizeKg: line.bagSizeKg, qty: line.qty }
        : emptyLeg()
    }
    source.value = first('source')
    target.value = first('target')
    remarks.value = txn.remarks ?? ''
  },
  { immediate: true }
)
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8"
    data-testid="stock-transfer-page"
  >
    <div class="flex items-center gap-3">
      <RefreshCcw class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ editId ? 'Edit Stock Transfer' : 'New Stock Transfer' }}
      </h1>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <div
        v-for="side in [
          { key: 'source' as const, label: 'From (removed)', leg: source, kg: sourceKg },
          { key: 'target' as const, label: 'To (added)', leg: target, kg: targetKg }
        ]"
        :key="side.key"
        class="space-y-3 rounded-md border p-4"
        :data-testid="`transfer-${side.key}`"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ side.label }}</h2>
          <span class="text-sm text-muted-foreground tabular-nums"
            >{{ formatQty(side.kg) }} kg</span
          >
        </div>
        <div class="flex flex-wrap items-center gap-2" data-testid="transfer-leg">
          <div class="min-w-[12rem] flex-1">
            <EntityCombobox
              :model-value="side.leg.productId"
              :options="productOptions"
              placeholder="Product"
              search-placeholder="Type a product name…"
              empty-text="No product matches."
              test-id="transfer-product"
              @update:model-value="onProduct(side.leg, $event, side.key)"
            />
          </div>
          <span
            v-if="isBulk(side.leg)"
            class="w-16 shrink-0 text-center text-sm text-muted-foreground"
            data-testid="transfer-bag"
          >
            {{ side.leg.bagSizeKg }}kg
          </span>
          <Input
            type="number"
            min="0"
            step="0.5"
            class="w-28 shrink-0 tabular-nums"
            :model-value="side.leg.qty ?? ''"
            placeholder="Qty"
            data-testid="transfer-qty"
            @update:model-value="onQtyInput(side.leg, $event, side.key)"
          />
          <span
            class="w-24 shrink-0 text-right text-sm text-muted-foreground tabular-nums"
            data-testid="transfer-leg-kg"
          >
            {{ rowKg(side.leg) > 0 ? `${formatQty(rowKg(side.leg))} kg` : '' }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex flex-col items-center gap-1 text-sm text-muted-foreground">
      <div class="flex items-center justify-center gap-2">
        <span class="tabular-nums">{{ formatQty(sourceKg) }} kg</span>
        <ArrowRight class="size-4" />
        <span class="tabular-nums">{{ formatQty(targetKg) }} kg</span>
        <span v-if="sourceKg !== targetKg && (sourceKg || targetKg)" class="text-amber-600">
          (yield difference {{ formatQty(targetKg - sourceKg) }} kg)
        </span>
        <TooltipProvider v-if="canResuggestTargetQty" :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="size-8 shrink-0"
                data-testid="transfer-resuggest"
                aria-label="Re-suggest target quantity from source kg"
                @click="resumeTargetQtySuggestion"
              >
                <RotateCcw class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Re-suggest target qty from source kg</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <p v-if="targetQtySuggested" class="text-xs" data-testid="transfer-qty-suggested">
        Target qty suggested from source kg — edit to set a yield difference.
      </p>
    </div>

    <div class="flex items-center justify-between border-t pt-4">
      <p v-if="error" class="text-sm text-destructive" data-testid="transfer-error">{{ error }}</p>
      <span v-else></span>
      <Button size="lg" data-testid="transfer-finish" @click="finish">Record Transfer</Button>
    </div>
  </div>
</template>
