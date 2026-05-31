<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ShoppingCart } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import GoodsCart, { type CartLine } from '@/components/transaction/GoodsCart.vue'
import SlipPreview from '@/components/transaction/SlipPreview.vue'
import CustomerSelect from '@/components/customer/CustomerSelect.vue'
import { useProductsQuery } from '@/queries/products'
import { useCustomersQuery } from '@/queries/customers'
import { useSettingsQuery } from '@/queries/operations'
import { useCreateSale, useEditSale } from '@/queries/transactions'
import { useTransactionExit } from '@/lib/transaction-exit'
import {
  computeLoadingCharge,
  grandTotal,
  lineTotal,
  validateSale
} from '@domain/transaction-rules'
import { formatRupees } from '@/lib/format'
import type { CreateSaleInput, SaleMode, Txn } from '@domain/transaction'
import type { LineProductLookup } from '@domain/transaction-rules'

const route = useRoute()
const exit = useTransactionExit()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const { data: customers } = useCustomersQuery()
const { data: settings } = useSettingsQuery()
const createSale = useCreateSale()
const editSale = useEditSale()

const counterpartyMode = ref<'customer' | 'walkin'>('customer')
const customerId = ref<number | null>(null)
const walkinName = ref('')
const walkinPlace = ref('')
const walkinPhone = ref('')

const mode = ref<SaleMode>('cash')
const lines = ref<CartLine[]>([])
const applyLoading = ref(false)
const additionalCharges = ref<number | null>(null)
const cashCollected = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const remarks = ref('')

const error = ref<string | null>(null)
const finished = ref<Txn | null>(null)
const slipOpen = ref(false)

const productList = computed(() => products.value ?? [])
const customerList = computed(() => customers.value ?? [])
const bagTypes = computed(() => settings.value?.bagTypes ?? [25, 30, 50])

const selectedCustomer = computed(() =>
  customerId.value == null
    ? null
    : (customerList.value.find((c) => c.id === customerId.value) ?? null)
)

const productLookup = computed(() => {
  const map = new Map<number, LineProductLookup>()
  for (const p of productList.value)
    map.set(p.id, { type: p.type, defaultBagSizeKg: p.defaultBagSizeKg })
  return map
})

const lineTotals = computed(() =>
  lines.value.map((l) => {
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
)

const loadingCharge = computed(() => {
  if (!applyLoading.value) return 0
  const rules = settings.value?.loadingChargePerBag ?? {}
  return computeLoadingCharge(
    lines.value.map((l) => {
      const p = l.productId == null ? undefined : productLookup.value.get(l.productId)
      return { productType: p?.type ?? 'packaged', bagSizeKg: l.bagSizeKg, qty: l.qty ?? 0 }
    }),
    rules
  )
})

const total = computed(() =>
  grandTotal(lineTotals.value, loadingCharge.value, additionalCharges.value ?? 0)
)

function buildInput(): CreateSaleInput {
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
    loadingCharges: loadingCharge.value,
    cashCollected: mode.value === 'cash' ? (cashCollected.value ?? 0) : 0,
    upiCollected: mode.value === 'cash' ? (upiCollected.value ?? 0) : 0,
    remarks: remarks.value.trim() || null
  }
}

function finish(): void {
  error.value = null
  const input = buildInput()
  const reason = validateSale(input.lines, productLookup.value, {
    mode: mode.value,
    hasCustomer: counterpartyMode.value === 'customer' && customerId.value != null,
    customerHasPhone: !!selectedCustomer.value?.phone,
    isWalkin: counterpartyMode.value === 'walkin'
  })
  if (
    counterpartyMode.value === 'walkin' &&
    (!walkinName.value.trim() || !walkinPlace.value.trim())
  ) {
    error.value = 'Walk-in Sales need a name and place'
    return
  }
  if (reason) {
    error.value = reason
    return
  }

  const onSuccess = (txn: Txn): void => {
    finished.value = txn
    slipOpen.value = true
  }
  if (editId.value) {
    editSale.mutate({ id: editId.value, input }, { onSuccess })
  } else {
    createSale.mutate(input, { onSuccess })
  }
}

function onSlipDone(): void {
  slipOpen.value = false
  exit()
}

// Prefill when editing an existing Sale.
watch(
  [editId, customers],
  async () => {
    if (!editId.value || lines.value.length > 0) return
    const txn = await window.api.getTransaction(editId.value)
    if (!txn || txn.type !== 'SA') return
    mode.value = txn.saleMode ?? 'cash'
    counterpartyMode.value = txn.customerId != null ? 'customer' : 'walkin'
    customerId.value = txn.customerId
    walkinName.value = txn.walkinName ?? ''
    walkinPlace.value = txn.walkinPlace ?? ''
    walkinPhone.value = txn.walkinPhone ?? ''
    additionalCharges.value = txn.additionalCharges || null
    applyLoading.value = txn.loadingCharges > 0
    cashCollected.value = txn.cashIn || null
    upiCollected.value = txn.upiIn || null
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
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8" data-testid="sale-page">
    <div class="flex items-center gap-3">
      <ShoppingCart class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ editId ? 'Edit Sale' : 'New Sale' }}
      </h1>
    </div>

    <!-- Counterparty -->
    <div class="flex flex-wrap items-end gap-4">
      <div class="grid gap-2">
        <Label>Customer</Label>
        <Select v-model="counterpartyMode">
          <SelectTrigger class="w-[180px]" data-testid="sale-counterparty-mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="customer">Customer Master</SelectItem>
            <SelectItem value="walkin">Walk-in</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div v-if="counterpartyMode === 'customer'" class="grid gap-2">
        <Label>Select customer</Label>
        <CustomerSelect v-model="customerId" :auto-focus="true" test-id="sale-customer" />
      </div>

      <template v-else>
        <div class="grid gap-2">
          <Label>Name</Label>
          <Input v-model="walkinName" placeholder="Name" autofocus data-testid="sale-walkin-name" />
        </div>
        <div class="grid gap-2">
          <Label>Place</Label>
          <Input v-model="walkinPlace" placeholder="Place" data-testid="sale-walkin-place" />
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
      <div class="space-y-3">
        <label class="flex items-center gap-2 text-sm">
          <Checkbox
            :model-value="applyLoading"
            @update:model-value="applyLoading = $event === true"
          />
          Apply Loading Charge ({{ formatRupees(loadingCharge) }})
        </label>
        <div class="grid gap-2">
          <Label>Additional Charges</Label>
          <Input
            type="number"
            min="0"
            :model-value="additionalCharges ?? ''"
            placeholder="0"
            data-testid="sale-additional"
            @update:model-value="additionalCharges = $event === '' ? null : Number($event)"
          />
        </div>
      </div>

      <div class="space-y-3">
        <div class="grid gap-2">
          <Label>Payment Mode</Label>
          <Select v-model="mode">
            <SelectTrigger class="w-[160px]" data-testid="sale-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div v-if="mode === 'cash'" class="grid grid-cols-2 gap-2">
          <div class="grid gap-2">
            <Label>Cash</Label>
            <Input
              type="number"
              min="0"
              :model-value="cashCollected ?? ''"
              placeholder="0"
              data-testid="sale-cash"
              @update:model-value="cashCollected = $event === '' ? null : Number($event)"
            />
          </div>
          <div class="grid gap-2">
            <Label>UPI</Label>
            <Input
              type="number"
              min="0"
              :model-value="upiCollected ?? ''"
              placeholder="0"
              data-testid="sale-upi"
              @update:model-value="upiCollected = $event === '' ? null : Number($event)"
            />
          </div>
        </div>
        <p v-else class="text-sm text-muted-foreground">
          Credit Sale — a signed Credit Voucher is collected in lieu of cash.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between border-t pt-4">
      <div>
        <p class="text-sm text-muted-foreground">Total</p>
        <p class="text-2xl font-semibold tabular-nums" data-testid="sale-total">
          {{ formatRupees(total) }}
        </p>
      </div>
      <div class="flex items-center gap-3">
        <p v-if="error" class="text-sm text-destructive" data-testid="sale-error">{{ error }}</p>
        <Button size="lg" data-testid="sale-finish" @click="finish">
          {{ mode === 'credit' ? 'Finish — Credit' : 'Finish — Cash' }}
        </Button>
      </div>
    </div>

    <SlipPreview
      :open="slipOpen"
      :txn="finished"
      :printerless="settings?.printerlessMode ?? false"
      @update:open="(v) => (slipOpen = v)"
      @done="onSlipDone"
    />
  </div>
</template>
