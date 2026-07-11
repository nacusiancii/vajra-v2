<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Plus, RefreshCcw, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import type { CreateStockTransferInput } from '@domain/transaction'

interface LegRow {
  productId: number | null
  bagSizeKg: number | null
  qty: number | null
}

type Side = 'source' | 'target'

const emptyLeg = (): LegRow => ({ productId: null, bagSizeKg: null, qty: null })

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const createTransfer = useCreateStockTransfer()
const editTransfer = useEditStockTransfer()

const source = ref<LegRow[]>([emptyLeg()])
const target = ref<LegRow[]>([emptyLeg()])
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

function legKg(legs: LegRow[]): number {
  return legs.reduce((sum, leg) => {
    const p = leg.productId == null ? undefined : productMap.value.get(leg.productId)
    if (!p || !leg.qty) return sum
    return sum + lineKg(p.type, leg.qty, leg.bagSizeKg)
  }, 0)
}

const sourceKg = computed(() => legKg(source.value))
const targetKg = computed(() => legKg(target.value))

function legsFor(side: Side): typeof source {
  return side === 'source' ? source : target
}

function parseQty(value: string | number): number | null {
  return value === '' ? null : Number(value)
}

function markTargetQtyManual(): void {
  targetQtyDirty.value = true
  targetQtySuggested.value = false
}

/** Resume auto-fill (e.g. after target product change or back to a single target leg). */
function resumeTargetQtySuggestion(): void {
  targetQtyDirty.value = false
  applySuggestedTargetQty()
}

function add(side: Side): void {
  const legs = legsFor(side)
  legs.value = [...legs.value, emptyLeg()]
  // Multi-target cannot share one kg→qty suggestion.
  if (side === 'target') markTargetQtyManual()
}

function remove(side: Side, index: number): void {
  const legs = legsFor(side)
  legs.value = legs.value.filter((_, i) => i !== index)
  if (legs.value.length === 0) legs.value = [emptyLeg()]
  if (side === 'target' && legs.value.length === 1) resumeTargetQtySuggestion()
}

function onProduct(leg: LegRow, value: number | null, side: Side): void {
  leg.productId = value
  const p = value == null ? undefined : productMap.value.get(value)
  // Stock Transfers always move Default-Bag-Size bags — no per-leg bag choice.
  leg.bagSizeKg = p?.type === 'bulk' ? (p.defaultBagSizeKg ?? null) : null
  if (side === 'target') resumeTargetQtySuggestion()
}

function onQtyInput(leg: LegRow, value: string | number, side: Side): void {
  leg.qty = parseQty(value)
  if (side === 'target') markTargetQtyManual()
}

/**
 * Fill the single bulk target leg as sourceKg ÷ target Default Bag Size.
 * No-op when the cashier has overridden qty, there are multiple targets, or kg is unknown.
 */
function applySuggestedTargetQty(): void {
  if (targetQtyDirty.value || target.value.length !== 1) {
    targetQtySuggested.value = false
    return
  }
  const leg = target.value[0]
  const p = leg.productId == null ? undefined : productMap.value.get(leg.productId)
  if (!p || p.type !== 'bulk') {
    targetQtySuggested.value = false
    return
  }
  const suggested = suggestedTransferTargetQty(sourceKg.value, p.defaultBagSizeKg)
  if (suggested == null) {
    targetQtySuggested.value = false
    return
  }
  leg.qty = suggested
  targetQtySuggested.value = true
}

function rowKg(leg: LegRow): number {
  const p = leg.productId == null ? undefined : productMap.value.get(leg.productId)
  if (!p || !leg.qty) return 0
  return lineKg(p.type, leg.qty, leg.bagSizeKg)
}

function buildInput(): CreateStockTransferInput {
  const map = (legs: LegRow[]): CreateStockTransferInput['source'] =>
    legs
      .filter((l) => l.productId != null)
      .map((l) => ({ productId: l.productId as number, bagSizeKg: l.bagSizeKg, qty: l.qty ?? 0 }))
  return {
    source: map(source.value),
    target: map(target.value),
    remarks: remarks.value.trim() || null
  }
}

function finish(): void {
  error.value = null
  const input = buildInput()
  if (input.source.length === 0 || input.target.length === 0) {
    error.value = 'A Stock Transfer needs at least one source and one target'
    return
  }
  for (const leg of [...input.source, ...input.target]) {
    const reason = validateTransferLeg(leg, productLookup.value.get(leg.productId))
    if (reason) {
      error.value = reason
      return
    }
  }
  const onSuccess = (): void => void router.push('/transactions')
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
    const toRows = (side: Side): LegRow[] =>
      txn.lines
        .filter((l) => l.side === side)
        .map((l) => ({ productId: l.productId, bagSizeKg: l.bagSizeKg, qty: l.qty }))
    source.value = toRows('source')
    target.value = toRows('target')
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
        v-for="leg in [
          { key: 'source', label: 'From (removed)', legs: source, kg: sourceKg },
          { key: 'target', label: 'To (added)', legs: target, kg: targetKg }
        ] as const"
        :key="leg.key"
        class="space-y-3 rounded-md border p-4"
        :data-testid="`transfer-${leg.key}`"
      >
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">{{ leg.label }}</h2>
          <span class="text-sm text-muted-foreground tabular-nums">{{ formatQty(leg.kg) }} kg</span>
        </div>
        <div
          v-for="(row, index) in leg.legs"
          :key="index"
          class="flex items-center gap-2"
          data-testid="transfer-leg"
        >
          <div class="flex-1">
            <EntityCombobox
              :model-value="row.productId"
              :options="productOptions"
              placeholder="Product"
              search-placeholder="Type a product name…"
              empty-text="No product matches."
              test-id="transfer-product"
              @update:model-value="onProduct(row, $event, leg.key)"
            />
          </div>
          <span
            v-if="isBulk(row)"
            class="w-[64px] shrink-0 text-center text-sm text-muted-foreground"
            data-testid="transfer-bag"
          >
            {{ row.bagSizeKg }}kg
          </span>
          <Input
            type="number"
            min="0"
            step="0.5"
            class="w-[72px]"
            :model-value="row.qty ?? ''"
            placeholder="Qty"
            data-testid="transfer-qty"
            @update:model-value="onQtyInput(row, $event, leg.key)"
          />
          <span class="w-[72px] shrink-0 text-right text-xs text-muted-foreground tabular-nums">
            {{ rowKg(row) > 0 ? `${formatQty(rowKg(row))} kg` : '' }}
          </span>
          <Button variant="ghost" size="icon" @click="remove(leg.key, index)">
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
        <Button variant="outline" size="sm" @click="add(leg.key)">
          <Plus class="mr-2 size-4" /> Add
        </Button>
      </div>
    </div>

    <div class="flex flex-col items-center gap-1 text-sm text-muted-foreground">
      <div class="flex items-center justify-center gap-3">
        <span class="tabular-nums">{{ formatQty(sourceKg) }} kg</span>
        <ArrowRight class="size-4" />
        <span class="tabular-nums">{{ formatQty(targetKg) }} kg</span>
        <span v-if="sourceKg !== targetKg && (sourceKg || targetKg)" class="text-amber-600">
          (yield difference {{ formatQty(targetKg - sourceKg) }} kg)
        </span>
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
