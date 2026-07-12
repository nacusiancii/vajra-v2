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
import { moneyFace, moneyRealized } from '@domain/transaction'
import { formatRupees } from '@/lib/format'
import { parseRupeesInput, paiseInputValue } from '@/lib/money-input'
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
    /** RE/PA: cash + UPI + discount ₹. EX/IN: amount with UPI typed, cash auto. */
    settlementEntry: boolean
    icon: typeof HandCoins
  }
> = {
  RE: {
    title: 'Receipt',
    route: 'receipt',
    needsCustomer: true,
    needsLabel: false,
    settlementEntry: true,
    icon: HandCoins
  },
  PA: {
    title: 'Payment',
    route: 'payment',
    needsCustomer: true,
    needsLabel: false,
    settlementEntry: true,
    icon: Wallet
  },
  EX: {
    title: 'Expense',
    route: 'expense',
    needsCustomer: false,
    needsLabel: true,
    settlementEntry: false,
    icon: CircleDollarSign
  },
  IN: {
    title: 'Income',
    route: 'income',
    needsCustomer: false,
    needsLabel: true,
    settlementEntry: false,
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
/** EX/IN only — face amount; cash is the remainder after UPI. */
const amount = ref<number | null>(null)
const cashCollected = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const discountAmount = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)

// EX/IN: cashier types UPI; cash is the remainder of the amount.
const cashDue = computed(() => Math.max((amount.value ?? 0) - (upiCollected.value ?? 0), 0))

// RE/PA live summary only (cash + UPI + optional write-off).
const realized = computed(() => moneyRealized(cashCollected.value ?? 0, upiCollected.value ?? 0))
const face = computed(() =>
  moneyFace(cashCollected.value ?? 0, upiCollected.value ?? 0, discountAmount.value ?? 0)
)

/** Drawer cash/UPI for a money txn (only one side is non-zero). */
function drawerCash(txn: { cashIn: number; cashOut: number }): number {
  return txn.cashIn || txn.cashOut
}
function drawerUpi(txn: { upiIn: number; upiOut: number }): number {
  return txn.upiIn || txn.upiOut
}

function finish(): void {
  error.value = null

  let cash: number
  let upi: number
  let discount: number

  if (config.value.settlementEntry) {
    cash = cashCollected.value ?? 0
    upi = upiCollected.value ?? 0
    discount = discountAmount.value ?? 0
  } else {
    const faceAmount = amount.value ?? 0
    if (!(faceAmount > 0)) {
      error.value = 'Amount must be greater than zero'
      return
    }
    upi = upiCollected.value ?? 0
    cash = cashDue.value
    discount = 0
    if (cash + upi !== faceAmount) {
      error.value = 'UPI cannot exceed the amount'
      return
    }
  }

  if (config.value.needsCustomer && customerId.value == null) {
    error.value = `${config.value.title} needs a Customer`
    return
  }
  if (config.value.needsLabel && !label.value.trim()) {
    error.value = `${config.value.title} needs a label`
    return
  }

  const parsed = MoneyTxnSchema.safeParse({
    customerId: customerId.value,
    label: label.value,
    cashCollected: cash,
    upiCollected: upi,
    discountAmount: discount,
    remarks: remarks.value
  })
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Invalid entry'
    return
  }

  const input = parsed.data
  const onSuccess = (): void => void router.push('/')
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
    remarks.value = txn.remarks ?? ''

    const cash = drawerCash(txn)
    const upi = drawerUpi(txn)
    if (config.value.settlementEntry) {
      cashCollected.value = cash || null
      upiCollected.value = upi || null
      discountAmount.value = txn.discountAmount || null
      amount.value = null
    } else {
      // EX/IN: restore face as total (realized); cash auto-derives from UPI.
      amount.value = txn.total || null
      upiCollected.value = upi || null
      cashCollected.value = null
      discountAmount.value = null
    }
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

    <!-- EX / IN: amount + UPI typed, cash auto -->
    <template v-if="!config.settlementEntry">
      <div class="grid gap-2">
        <Label>Amount</Label>
        <Input
          type="number"
          min="0"
          :model-value="paiseInputValue(amount)"
          placeholder="0"
          data-testid="money-amount"
          @update:model-value="amount = parseRupeesInput($event)"
        />
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="grid gap-2">
          <Label>UPI</Label>
          <Input
            type="number"
            min="0"
            :model-value="paiseInputValue(upiCollected)"
            placeholder="0"
            data-testid="money-upi"
            @update:model-value="upiCollected = parseRupeesInput($event)"
          />
        </div>
        <div class="grid gap-2">
          <Label>Cash (auto)</Label>
          <Input
            :model-value="paiseInputValue(cashDue)"
            type="number"
            disabled
            data-testid="money-cash"
          />
        </div>
      </div>
    </template>

    <!-- RE / PA: cash, UPI, and discount ₹ all editable -->
    <template v-else>
      <div class="grid grid-cols-2 gap-4">
        <div class="grid gap-2">
          <Label>Cash</Label>
          <Input
            type="number"
            min="0"
            :model-value="paiseInputValue(cashCollected)"
            placeholder="0"
            data-testid="money-cash"
            @update:model-value="cashCollected = parseRupeesInput($event)"
          />
        </div>
        <div class="grid gap-2">
          <Label>UPI</Label>
          <Input
            type="number"
            min="0"
            :model-value="paiseInputValue(upiCollected)"
            placeholder="0"
            data-testid="money-upi"
            @update:model-value="upiCollected = parseRupeesInput($event)"
          />
        </div>
      </div>

      <div class="grid gap-2">
        <Label>Discount (₹)</Label>
        <Input
          type="number"
          min="0"
          :model-value="paiseInputValue(discountAmount)"
          placeholder="0"
          data-testid="money-discount"
          @update:model-value="discountAmount = parseRupeesInput($event)"
        />
      </div>

      <div
        v-if="(discountAmount ?? 0) > 0 || realized > 0"
        class="text-sm text-muted-foreground"
        data-testid="money-summary"
      >
        <span v-if="(discountAmount ?? 0) > 0">
          Realized
          <span class="font-medium tabular-nums">{{ formatRupees(realized) }}</span>
          · Face
          <span class="font-medium tabular-nums">{{ formatRupees(face) }}</span>
        </span>
        <span v-else>
          Total
          <span class="font-medium tabular-nums">{{ formatRupees(realized) }}</span>
        </span>
      </div>
    </template>

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
