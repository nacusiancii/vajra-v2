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
import CustomerSelect from '@/components/customer/CustomerSelect.vue'
import { useProductsQuery } from '@/queries/products'
import { useSettingsQuery } from '@/queries/operations'
import { useCreatePurchase, useEditPurchase } from '@/queries/transactions'
import { grandTotal, lineTotal, validatePurchase } from '@domain/transaction-rules'
import { formatRupees } from '@/lib/format'
import type { CreatePurchaseInput, SaleMode } from '@domain/transaction'
import type { LineProductLookup } from '@domain/transaction-rules'

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const { data: settings } = useSettingsQuery()
const createPurchase = useCreatePurchase()
const editPurchase = useEditPurchase()

const counterpartyMode = ref<'customer' | 'walkin'>('customer')
const customerId = ref<number | null>(null)
const walkinName = ref('')
const walkinPlace = ref('')
const walkinPhone = ref('')

const mode = ref<SaleMode>('cash')
const lines = ref<CartLine[]>([])
const additionalCharges = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)

const productList = computed(() => products.value ?? [])
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

// Cashier types UPI paid; cash paid is the remainder of the total.
const cashDue = computed(() => Math.max(total.value - (upiCollected.value ?? 0), 0))

function buildInput(): CreatePurchaseInput {
  return {
    mode: mode.value,
    customerId: counterpartyMode.value === 'customer' ? customerId.value : null,
    walkin:
      counterpartyMode.value === 'walkin'
        ? {
            name: walkinName.value.trim(),
            place: walkinPlace.value.trim(),
            phone: walkinPhone.value.trim() || null
          }
        : null,
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
    cashCollected: mode.value === 'cash' ? cashDue.value : 0,
    upiCollected: mode.value === 'cash' ? (upiCollected.value ?? 0) : 0,
    remarks: remarks.value.trim() || null
  }
}

function finish(): void {
  error.value = null
  const input = buildInput()
  if (counterpartyMode.value === 'walkin' && !walkinName.value.trim()) {
    error.value = 'Walk-in Purchases need a supplier name'
    return
  }
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
    mode.value = txn.saleMode ?? 'cash'
    counterpartyMode.value =
      txn.customerId != null ? 'customer' : txn.walkinName ? 'walkin' : 'customer'
    customerId.value = txn.customerId
    walkinName.value = txn.walkinName ?? ''
    walkinPlace.value = txn.walkinPlace ?? ''
    walkinPhone.value = txn.walkinPhone ?? ''
    additionalCharges.value = txn.additionalCharges || null
    upiCollected.value = txn.upiOut || null
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

    <!-- Counterparty -->
    <div class="flex flex-wrap items-end gap-4">
      <div class="grid gap-2">
        <Label>Supplier</Label>
        <Select v-model="counterpartyMode">
          <SelectTrigger class="w-[180px]" data-testid="purchase-counterparty-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer Master</SelectItem>
            <SelectItem value="walkin">Walk-in</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="counterpartyMode === 'customer'" class="grid flex-1 gap-2">
        <Label>Select supplier</Label>
        <CustomerSelect v-model="customerId" :auto-focus="true" test-id="purchase-customer" />
      </div>

      <template v-else>
        <div class="grid gap-2">
          <Label>Name</Label>
          <Input
            v-model="walkinName"
            placeholder="Supplier name"
            autofocus
            data-testid="purchase-walkin-name"
          />
        </div>
        <div class="grid gap-2">
          <Label>Place</Label>
          <Input v-model="walkinPlace" placeholder="Optional" />
        </div>
        <div class="grid gap-2">
          <Label>Phone</Label>
          <Input v-model="walkinPhone" placeholder="Optional" />
        </div>
      </template>
    </div>

    <GoodsCart v-model="lines" :products="productList" :bag-types="bagTypes" />

    <!-- Charges + payment -->
    <div class="grid gap-4 sm:grid-cols-2">
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

      <div class="space-y-3">
        <div class="grid gap-2">
          <Label>Payment Mode</Label>
          <Select v-model="mode">
            <SelectTrigger class="w-[160px]" data-testid="purchase-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash paid</SelectItem>
              <SelectItem value="credit">Credit received</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="mode === 'cash'" class="grid grid-cols-2 gap-2">
          <div class="grid gap-2">
            <Label>UPI</Label>
            <Input
              type="number"
              min="0"
              :model-value="upiCollected ?? ''"
              placeholder="0"
              data-testid="purchase-upi"
              @update:model-value="upiCollected = $event === '' ? null : Number($event)"
            />
          </div>
          <div class="grid gap-2">
            <Label>Cash (auto)</Label>
            <Input :model-value="cashDue" type="number" disabled data-testid="purchase-cash" />
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          Credit Purchase — recorded as owed to the supplier; settle later via a Payment.
        </p>
      </div>
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
        <Button size="lg" data-testid="purchase-finish" @click="finish">
          {{ mode === 'credit' ? 'Record — Credit' : 'Record Purchase' }}
        </Button>
      </div>
    </div>
  </div>
</template>
