<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Banknote, CircleDollarSign, HandCoins, Wallet } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CustomerSelect from '@/components/customer/CustomerSelect.vue'
import { useCreateMoneyTxn, useEditMoneyTxn } from '@/queries/transactions'
import { MoneyTxnSchema } from '@domain/transaction-rules'
import { moneyNetAmount } from '@domain/transaction'
import { formatRupees } from '@/lib/format'
import type { MoneyTxnType } from '@shared/api'

const route = useRoute()
const router = useRouter()

const CONFIG: Record<
  MoneyTxnType,
  {
    title: string
    route: string
    needsCustomer: boolean
    needsLabel: boolean
    hasDiscount: boolean
    direction: 'in' | 'out'
    icon: typeof HandCoins
  }
> = {
  RE: {
    title: 'Receipt',
    route: 'receipt',
    needsCustomer: true,
    needsLabel: false,
    hasDiscount: true,
    direction: 'in',
    icon: HandCoins
  },
  PA: {
    title: 'Payment',
    route: 'payment',
    needsCustomer: true,
    needsLabel: false,
    hasDiscount: true,
    direction: 'out',
    icon: Wallet
  },
  EX: {
    title: 'Expense',
    route: 'expense',
    needsCustomer: false,
    needsLabel: true,
    hasDiscount: false,
    direction: 'out',
    icon: CircleDollarSign
  },
  IN: {
    title: 'Income',
    route: 'income',
    needsCustomer: false,
    needsLabel: true,
    hasDiscount: false,
    direction: 'in',
    icon: Banknote
  }
}

const type = computed<MoneyTxnType>(() => {
  const byRoute = (Object.keys(CONFIG) as MoneyTxnType[]).find(
    (k) => CONFIG[k].route === route.name
  )
  return byRoute ?? 'RE'
})
const config = computed(() => CONFIG[type.value])
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const createMoney = useCreateMoneyTxn()
const editMoney = useEditMoneyTxn()

const customerId = ref<number | null>(null)
const label = ref('')
const amount = ref<number | null>(null)
const discountPercent = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)

const discount = computed(() => (config.value.hasDiscount ? (discountPercent.value ?? 0) : 0))
const net = computed(() => moneyNetAmount(amount.value ?? 0, discount.value))
// Cashier types UPI; cash is the remainder of the net.
const cashDue = computed(() => Math.max(net.value - (upiCollected.value ?? 0), 0))

function finish(): void {
  error.value = null
  const parsed = MoneyTxnSchema.safeParse({
    customerId: customerId.value,
    label: label.value,
    amount: amount.value ?? 0,
    discountPercent: discount.value,
    cashCollected: cashDue.value,
    upiCollected: upiCollected.value ?? 0,
    remarks: remarks.value
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Invalid entry'
    return
  }
  if (config.value.needsCustomer && customerId.value == null) {
    error.value = `${config.value.title} needs a Customer`
    return
  }
  if (config.value.needsLabel && !label.value.trim()) {
    error.value = `${config.value.title} needs a label`
    return
  }
  const input = parsed.data
  const onSuccess = (): void => void router.push('/transactions')
  if (editId.value) {
    editMoney.mutate({ id: editId.value, type: type.value, input }, { onSuccess })
  } else {
    createMoney.mutate({ type: type.value, input }, { onSuccess })
  }
}

watch(
  [editId, type],
  async () => {
    if (!editId.value) return
    const txn = await window.api.getTransaction(editId.value)
    if (!txn || txn.type !== type.value) return
    customerId.value = txn.customerId
    label.value = txn.label ?? ''
    // Discount isn't persisted, so an edit starts from the net amount with 0% discount.
    amount.value = txn.total || null
    discountPercent.value = null
    upiCollected.value = txn.upiIn || txn.upiOut || null
    remarks.value = txn.remarks ?? ''
  },
  { immediate: true }
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-8" data-testid="money-page">
    <div class="flex items-center gap-3">
      <component :is="config.icon" class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">
        {{ editId ? `Edit ${config.title}` : `New ${config.title}` }}
      </h1>
    </div>

    <div v-if="config.needsCustomer" class="grid gap-2">
      <Label>Customer</Label>
      <CustomerSelect v-model="customerId" :auto-focus="true" test-id="money-customer" />
    </div>

    <div v-if="config.needsLabel" class="grid gap-2">
      <Label>Label</Label>
      <Input
        v-model="label"
        placeholder="e.g. Rent, Electricity"
        autofocus
        data-testid="money-label"
      />
    </div>

    <div class="grid gap-4" :class="config.hasDiscount ? 'grid-cols-2' : 'grid-cols-1'">
      <div class="grid gap-2">
        <Label>Amount</Label>
        <Input
          type="number"
          min="0"
          :model-value="amount ?? ''"
          placeholder="0"
          data-testid="money-amount"
          @update:model-value="amount = $event === '' ? null : Number($event)"
        />
      </div>
      <div v-if="config.hasDiscount" class="grid gap-2">
        <Label>Discount %</Label>
        <Input
          type="number"
          min="0"
          max="100"
          :model-value="discountPercent ?? ''"
          placeholder="0"
          data-testid="money-discount"
          @update:model-value="discountPercent = $event === '' ? null : Number($event)"
        />
      </div>
    </div>

    <div v-if="config.hasDiscount && discount > 0" class="text-sm text-muted-foreground">
      Final amount: <span class="font-medium tabular-nums">{{ formatRupees(net) }}</span>
    </div>

    <div class="grid grid-cols-2 gap-4">
      <div class="grid gap-2">
        <Label>UPI</Label>
        <Input
          type="number"
          min="0"
          :model-value="upiCollected ?? ''"
          placeholder="0"
          data-testid="money-upi"
          @update:model-value="upiCollected = $event === '' ? null : Number($event)"
        />
      </div>
      <div class="grid gap-2">
        <Label>Cash (auto)</Label>
        <Input :model-value="cashDue" type="number" disabled data-testid="money-cash" />
      </div>
    </div>

    <div class="grid gap-2">
      <Label>Remarks</Label>
      <Input v-model="remarks" placeholder="Optional" />
    </div>

    <div class="flex items-center justify-between border-t pt-4">
      <p v-if="error" class="text-sm text-destructive" data-testid="money-error">{{ error }}</p>
      <span v-else></span>
      <Button size="lg" data-testid="money-finish" @click="finish">
        Record {{ config.title }}
      </Button>
    </div>
  </div>
</template>
