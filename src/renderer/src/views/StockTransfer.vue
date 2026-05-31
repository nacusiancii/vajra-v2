<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowRight, Plus, RefreshCcw, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useProductsQuery } from '@/queries/products'
import { useSettingsQuery } from '@/queries/operations'
import { useCreateStockTransfer, useEditStockTransfer } from '@/queries/transactions'
import { lineKg, validateTransferLeg } from '@domain/transaction-rules'
import { formatQty } from '@/lib/format'
import type { CreateStockTransferInput } from '@domain/transaction'
import type { LineProductLookup } from '@domain/transaction-rules'

interface LegRow {
  productId: number | null
  bagSizeKg: number | null
  qty: number | null
}

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const { data: settings } = useSettingsQuery()
const createTransfer = useCreateStockTransfer()
const editTransfer = useEditStockTransfer()

const source = ref<LegRow[]>([{ productId: null, bagSizeKg: null, qty: null }])
const target = ref<LegRow[]>([{ productId: null, bagSizeKg: null, qty: null }])
const remarks = ref('')
const error = ref<string | null>(null)

const productList = computed(() => products.value ?? [])
const bagTypes = computed(() => settings.value?.bagTypes ?? [25, 30, 50])
const productMap = computed(() => new Map(productList.value.map((p) => [p.id, p])))

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

function legsFor(side: 'source' | 'target'): typeof source {
  return side === 'source' ? source : target
}
function add(side: 'source' | 'target'): void {
  const legs = legsFor(side)
  legs.value = [...legs.value, { productId: null, bagSizeKg: null, qty: null }]
}
function remove(side: 'source' | 'target', index: number): void {
  const legs = legsFor(side)
  legs.value = legs.value.filter((_, i) => i !== index)
}
function onProduct(leg: LegRow, value: string): void {
  leg.productId = Number(value)
  const p = productMap.value.get(leg.productId)
  leg.bagSizeKg = p?.type === 'bulk' ? (p.defaultBagSizeKg ?? null) : null
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

watch(
  editId,
  async () => {
    if (!editId.value) return
    const txn = await window.api.getTransaction(editId.value)
    if (!txn || txn.type !== 'ST') return
    const toRows = (side: 'source' | 'target'): LegRow[] =>
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
          <Select
            :model-value="row.productId == null ? '' : String(row.productId)"
            @update:model-value="onProduct(row, $event as string)"
          >
            <SelectTrigger class="flex-1" data-testid="transfer-product">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in productList" :key="p.id" :value="String(p.id)">{{
                p.name
              }}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            v-if="isBulk(row)"
            :model-value="row.bagSizeKg == null ? '' : String(row.bagSizeKg)"
            @update:model-value="row.bagSizeKg = Number($event)"
          >
            <SelectTrigger class="w-[90px]" data-testid="transfer-bag"
              ><SelectValue placeholder="Bag"
            /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="b in bagTypes" :key="b" :value="String(b)">{{ b }}kg</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            step="0.5"
            class="w-[80px]"
            :model-value="row.qty ?? ''"
            placeholder="Qty"
            data-testid="transfer-qty"
            @update:model-value="row.qty = $event === '' ? null : Number($event)"
          />
          <Button variant="ghost" size="icon" @click="remove(leg.key, index)">
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
        <Button variant="outline" size="sm" @click="add(leg.key)">
          <Plus class="mr-2 size-4" /> Add
        </Button>
      </div>
    </div>

    <div class="flex items-center justify-center gap-3 text-sm text-muted-foreground">
      <span class="tabular-nums">{{ formatQty(sourceKg) }} kg</span>
      <ArrowRight class="size-4" />
      <span class="tabular-nums">{{ formatQty(targetKg) }} kg</span>
      <span v-if="sourceKg !== targetKg && (sourceKg || targetKg)" class="text-amber-600">
        (yield difference {{ formatQty(targetKg - sourceKg) }} kg)
      </span>
    </div>

    <div class="flex items-center justify-between border-t pt-4">
      <p v-if="error" class="text-sm text-destructive" data-testid="transfer-error">{{ error }}</p>
      <span v-else></span>
      <Button size="lg" data-testid="transfer-finish" @click="finish">Record Transfer</Button>
    </div>
  </div>
</template>
