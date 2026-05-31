<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Truck } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import GoodsCart, { type CartLine } from '@/components/transaction/GoodsCart.vue'
import { useProductsQuery } from '@/queries/products'
import { useCustomersQuery } from '@/queries/customers'
import { useSettingsQuery } from '@/queries/operations'
import { useCreatePurchase, useEditPurchase } from '@/queries/transactions'
import { grandTotal, lineTotal, validatePurchase } from '@domain/transaction-rules'
import { formatRupees } from '@/lib/format'
import type { CreatePurchaseInput } from '@domain/transaction'
import type { LineProductLookup } from '@domain/transaction-rules'

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const { data: customers } = useCustomersQuery()
const { data: settings } = useSettingsQuery()
const createPurchase = useCreatePurchase()
const editPurchase = useEditPurchase()

const customerId = ref<number | null>(null)
const lines = ref<CartLine[]>([])
const additionalCharges = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)

const productList = computed(() => products.value ?? [])
const customerList = computed(() => customers.value ?? [])
const bagTypes = computed(() => settings.value?.bagTypes ?? [25, 30, 50])

const productLookup = computed(() => {
  const map = new Map<number, LineProductLookup>()
  for (const p of productList.value)
    map.set(p.id, { type: p.type, defaultBagSizeKg: p.defaultBagSizeKg })
  return map
})

const total = computed(() => {
  const totals = lines.value.map((l) => {
    const p = l.productId == null ? undefined : productLookup.value.get(l.productId)
    if (!p || !l.qty) return 0
    return lineTotal({
      productType: p.type,
      qty: l.qty,
      bagSizeKg: l.bagSizeKg,
      quintalRate: l.quintalRate,
      unitRate: l.unitRate
    })
  })
  return grandTotal(totals, 0, additionalCharges.value ?? 0)
})

function buildInput(): CreatePurchaseInput {
  return {
    customerId: customerId.value,
    lines: lines.value
      .filter((l) => l.productId != null)
      .map((l) => ({
        productId: l.productId as number,
        bagSizeKg: l.bagSizeKg,
        quintalRate: l.quintalRate,
        unitRate: l.unitRate,
        qty: l.qty ?? 0
      })),
    additionalCharges: additionalCharges.value ?? 0,
    remarks: remarks.value.trim() || null
  }
}

function finish(): void {
  error.value = null
  const input = buildInput()
  const reason = validatePurchase(input.lines, productLookup.value)
  if (reason) {
    error.value = reason
    return
  }
  const onSuccess = (): void => void router.push('/transactions')
  if (editId.value) editPurchase.mutate({ id: editId.value, input }, { onSuccess })
  else createPurchase.mutate(input, { onSuccess })
}

watch(
  editId,
  async () => {
    if (!editId.value || lines.value.length > 0) return
    const txn = await window.api.getTransaction(editId.value)
    if (!txn || txn.type !== 'PU') return
    customerId.value = txn.customerId
    additionalCharges.value = txn.additionalCharges || null
    remarks.value = txn.remarks ?? ''
    lines.value = txn.lines.map((l) => ({
      productId: l.productId,
      bagSizeKg: l.bagSizeKg,
      quintalRate: l.quintalRate,
      unitRate: l.unitRate,
      qty: l.qty
    }))
  },
  { immediate: true }
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8" data-testid="purchase-page">
    <div class="flex items-center gap-3">
      <Truck class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ editId ? 'Edit Purchase' : 'New Purchase' }}
      </h1>
    </div>

    <div class="grid gap-2">
      <Label>Supplier (Customer Master)</Label>
      <Select
        :model-value="customerId == null ? '' : String(customerId)"
        @update:model-value="customerId = $event ? Number($event) : null"
      >
        <SelectTrigger class="w-[280px]" data-testid="purchase-customer">
          <SelectValue placeholder="Optional — choose a counterparty" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in customerList" :key="c.id" :value="String(c.id)">
            {{ c.name }} — {{ c.placeName }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <GoodsCart v-model="lines" :products="productList" :bag-types="bagTypes" />

    <div class="grid max-w-xs gap-2">
      <Label>Additional Charges</Label>
      <Input
        type="number"
        min="0"
        :model-value="additionalCharges ?? ''"
        placeholder="0"
        data-testid="purchase-additional"
        @update:model-value="additionalCharges = $event === '' ? null : Number($event)"
      />
    </div>

    <div class="flex items-center justify-between border-t pt-4">
      <div>
        <p class="text-sm text-muted-foreground">Total cost</p>
        <p class="text-2xl font-semibold tabular-nums" data-testid="purchase-total">
          {{ formatRupees(total) }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <p v-if="error" class="text-sm text-destructive" data-testid="purchase-error">
          {{ error }}
        </p>
        <Button size="lg" data-testid="purchase-finish" @click="finish">Record Purchase</Button>
      </div>
    </div>
  </div>
</template>
