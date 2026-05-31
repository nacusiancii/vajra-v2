<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Banknote, CircleDollarSign, HandCoins, Wallet } from '@lucide/vue'
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
import { useCustomersQuery } from '@/queries/customers'
import { useCreateMoneyTxn, useEditMoneyTxn } from '@/queries/transactions'
import { useTransactionExit } from '@/lib/transaction-exit'
import { MoneyTxnSchema } from '@domain/transaction-rules'
import type { MoneyMode } from '@domain/transaction'
import type { MoneyTxnType } from '@shared/api'

const route = useRoute()
const exit = useTransactionExit()

const CONFIG: Record<
  MoneyTxnType,
  {
    title: string
    route: string
    needsCustomer: boolean
    needsLabel: boolean
    direction: 'in' | 'out'
    icon: typeof HandCoins
  }
> = {
  RE: {
    title: 'Receipt',
    route: 'receipt',
    needsCustomer: true,
    needsLabel: false,
    direction: 'in',
    icon: HandCoins
  },
  PA: {
    title: 'Payment',
    route: 'payment',
    needsCustomer: true,
    needsLabel: false,
    direction: 'out',
    icon: Wallet
  },
  EX: {
    title: 'Expense',
    route: 'expense',
    needsCustomer: false,
    needsLabel: true,
    direction: 'out',
    icon: CircleDollarSign
  },
  IN: {
    title: 'Income',
    route: 'income',
    needsCustomer: false,
    needsLabel: true,
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

const { data: customers } = useCustomersQuery()
const createMoney = useCreateMoneyTxn()
const editMoney = useEditMoneyTxn()

const customerId = ref<number | null>(null)
const label = ref('')
const amount = ref<number | null>(null)
const mode = ref<MoneyMode>('cash')
const remarks = ref('')
const error = ref<string | null>(null)

const customerList = computed(() => customers.value ?? [])

function finish(): void {
  error.value = null
  const parsed = MoneyTxnSchema.safeParse({
    customerId: customerId.value,
    label: label.value,
    amount: amount.value ?? 0,
    mode: mode.value,
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
  const onSuccess = (): void => exit()
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
    amount.value = txn.total || null
    mode.value = txn.cashIn || txn.cashOut ? 'cash' : 'upi'
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
      <Select
        :model-value="customerId == null ? '' : String(customerId)"
        @update:model-value="customerId = $event ? Number($event) : null"
      >
        <SelectTrigger data-testid="money-customer">
          <SelectValue placeholder="Choose a customer" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in customerList" :key="c.id" :value="String(c.id)">
            {{ c.name }} — {{ c.placeName }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div v-if="config.needsLabel" class="grid gap-2">
      <Label>Label</Label>
      <Input v-model="label" placeholder="e.g. Rent, Electricity" data-testid="money-label" />
    </div>

    <div class="grid grid-cols-2 gap-4">
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
      <div class="grid gap-2">
        <Label>Mode</Label>
        <Select v-model="mode">
          <SelectTrigger data-testid="money-mode"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
          </SelectContent>
        </Select>
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
