<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, Banknote, FileSignature, Printer, ShoppingCart } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import GoodsCart, { type CartLine } from '@/components/transaction/GoodsCart.vue'
import SlipPreview from '@/components/transaction/SlipPreview.vue'
import CreditVoucherPreview, {
  type VoucherLine
} from '@/components/transaction/CreditVoucherPreview.vue'
import CustomerSelect from '@/components/customer/CustomerSelect.vue'
import { useProductsQuery } from '@/queries/products'
import { useCustomersQuery } from '@/queries/customers'
import { useSettingsQuery, useBusinessDayQuery } from '@/queries/operations'
import { useCreateSale, useEditSale } from '@/queries/transactions'
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
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))

const { data: products } = useProductsQuery()
const { data: customers } = useCustomersQuery()
const { data: settings } = useSettingsQuery()
const { data: businessDay } = useBusinessDayQuery()
const createSale = useCreateSale()
const editSale = useEditSale()

const counterpartyMode = ref<'customer' | 'walkin'>('customer')
const customerId = ref<number | null>(null)
const walkinName = ref('')
const walkinPlace = ref('')
const walkinPhone = ref('')

// Cash or Credit is chosen before anything else — the whole workspace hangs off it.
// null = the gate is still showing; editing an existing Sale prefills it instead.
const mode = ref<SaleMode | null>(null)
const lines = ref<CartLine[]>([])
const applyLoading = ref(false)
const additionalCharges = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const remarks = ref('')

const error = ref<string | null>(null)
const finished = ref<Txn | null>(null)
const slipOpen = ref(false)

// Credit Voucher: the customer signs a voucher printed at the current price before
// the Sale can finish. We track the total it was last printed at to catch price drift.
const printedAtTotal = ref<number | null>(null)
const printedVoucherSeq = ref<number | null>(null)
const voucherOpen = ref(false)
const printGateOpen = ref(false)

const productList = computed(() => products.value ?? [])
const customerList = computed(() => customers.value ?? [])
const bagTypes = computed(() => settings.value?.bagTypes ?? [25, 30, 50])

const isCredit = computed(() => mode.value === 'credit')

// Cash is the counter's common case — the gate pre-focuses its tile so a bare
// Enter starts a Cash Sale. (Not rendered when editing; the ref stays null.)
const cashTile = ref<HTMLButtonElement | null>(null)
onMounted(() => cashTile.value?.focus())

// Credit Sales reject walk-ins — flipping to credit snaps the counterparty back to
// the Customer Master; the walk-in fields keep their values in case the cashier flips back.
watch(mode, (m) => {
  if (m === 'credit' && counterpartyMode.value === 'walkin') counterpartyMode.value = 'customer'
})

const shellTint = computed(() => {
  if (mode.value === 'cash') return 'bg-emerald-50/60 dark:bg-emerald-950/20'
  if (mode.value === 'credit') return 'bg-amber-50/60 dark:bg-amber-950/20'
  return ''
})

const cardAccent = computed(() =>
  isCredit.value
    ? 'border-amber-200 dark:border-amber-900'
    : 'border-emerald-200 dark:border-emerald-900'
)

const finishTint = computed(() =>
  isCredit.value
    ? 'bg-amber-600 text-white hover:bg-amber-700'
    : 'bg-emerald-600 text-white hover:bg-emerald-700'
)

function segmentClass(m: SaleMode): string {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors'
  if (mode.value !== m) return `${base} text-muted-foreground hover:text-foreground`
  return m === 'cash' ? `${base} bg-emerald-600 text-white` : `${base} bg-amber-600 text-white`
}

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

// Cash is whatever the total isn't covered by UPI — the cashier only types UPI.
const cashDue = computed(() => Math.max(total.value - (upiCollected.value ?? 0), 0))

const selectedCustomerName = computed(() => selectedCustomer.value?.name ?? 'Customer')
const selectedCustomerPlace = computed(() => selectedCustomer.value?.placeName ?? '')
const voucherPrinted = computed(
  () => printedAtTotal.value !== null && Math.abs(printedAtTotal.value - total.value) < 0.01
)
const priceChangedSincePrint = computed(
  () => printedAtTotal.value !== null && Math.abs(printedAtTotal.value - total.value) >= 0.01
)

/** Snapshot of cart lines for the Credit Voucher back side. */
const voucherLines = computed<VoucherLine[]>(() =>
  lines.value
    .map((l, i) => {
      const p =
        l.productId == null ? undefined : productList.value.find((x) => x.id === l.productId)
      if (!p || !l.qty) return null
      return {
        productName: p.name,
        productType: p.type,
        qty: l.qty,
        bagSizeKg: l.bagSizeKg,
        quintalRate: l.quintalRate,
        unitRate: l.unitRate,
        lineTotal: lineTotals.value[i] ?? 0
      }
    })
    .filter((l): l is VoucherLine => l != null)
)

/**
 * "Print" the voucher at the current price so the customer can sign it. Each print mints
 * a fresh Voucher Number — a reprint after a price change burns the previous one.
 */
async function printVoucher(): Promise<void> {
  printedVoucherSeq.value = await window.api.reserveVoucherSeq()
  printedAtTotal.value = total.value
  printGateOpen.value = false
  voucherOpen.value = true
}

function buildInput(m: SaleMode): CreateSaleInput {
  return {
    mode: m,
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
    cashCollected: m === 'cash' ? cashDue.value : 0,
    upiCollected: m === 'cash' ? (upiCollected.value ?? 0) : 0,
    voucherSeq: m === 'credit' ? printedVoucherSeq.value : null,
    remarks: remarks.value.trim() || null
  }
}

function finish(): void {
  const m = mode.value
  if (!m) return
  error.value = null
  const input = buildInput(m)
  const reason = validateSale(input.lines, productLookup.value, {
    mode: m,
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

  // A Credit Sale can't finish until a voucher is printed at the current price for signing.
  if (m === 'credit' && !voucherPrinted.value) {
    printGateOpen.value = true
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
  void router.push('/transactions')
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
    upiCollected.value = txn.upiIn || null
    // Keep the existing voucher valid at its recorded price; a price change forces a reprint.
    printedVoucherSeq.value = txn.voucherSeq
    printedAtTotal.value = txn.saleMode === 'credit' ? txn.total : null
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
  <div
    class="min-h-full transition-colors"
    :class="shellTint"
    :data-mode="mode ?? 'unset'"
    data-testid="sale-page"
  >
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <ShoppingCart class="size-6" />
          <h1 class="text-2xl font-semibold tracking-tight">
            {{ editId ? 'Edit Sale' : 'New Sale' }}
          </h1>
        </div>

        <!-- Mode stays flippable mid-cart; the segmented control mirrors the gate's choice -->
        <div
          v-if="mode"
          class="inline-flex items-center rounded-lg border bg-background p-1"
          role="group"
          aria-label="Sale mode"
          data-testid="sale-mode"
        >
          <button
            type="button"
            :class="segmentClass('cash')"
            data-testid="sale-mode-cash"
            @click="mode = 'cash'"
          >
            <Banknote class="size-4" />
            Cash
          </button>
          <button
            type="button"
            :class="segmentClass('credit')"
            data-testid="sale-mode-credit"
            @click="mode = 'credit'"
          >
            <FileSignature class="size-4" />
            Credit
          </button>
        </div>
      </div>

      <!-- The gate: pick Cash or Credit before anything else -->
      <div
        v-if="mode === null && !editId"
        class="grid gap-4 sm:grid-cols-2"
        data-testid="sale-gate"
      >
        <p class="text-sm text-muted-foreground sm:col-span-2">
          How does this Sale settle? Customer, goods, and collection all follow from this.
        </p>
        <button
          ref="cashTile"
          type="button"
          class="flex flex-col items-start gap-2 rounded-xl border-2 border-emerald-200 bg-card p-6 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
          data-testid="sale-gate-cash"
          @click="mode = 'cash'"
        >
          <Banknote class="size-8 text-emerald-600" />
          <span class="flex items-center gap-2 text-xl font-semibold">
            Cash
            <kbd
              class="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              Enter ↵
            </kbd>
          </span>
          <span class="text-sm text-muted-foreground">
            Cash and/or UPI collected at finish. Customer Master entry or walk-in.
          </span>
        </button>
        <button
          type="button"
          class="flex flex-col items-start gap-2 rounded-xl border-2 border-amber-200 bg-card p-6 text-left transition-colors hover:border-amber-500 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-900 dark:hover:bg-amber-950/40"
          data-testid="sale-gate-credit"
          @click="mode = 'credit'"
        >
          <FileSignature class="size-8 text-amber-600" />
          <span class="text-xl font-semibold">Credit</span>
          <span class="text-sm text-muted-foreground">
            The customer signs a Credit Voucher in lieu of cash. Needs a Customer Master entry with
            a phone — no walk-ins.
          </span>
        </button>
      </div>

      <!-- The workspace: three cards that adapt to the chosen mode -->
      <template v-else-if="mode">
        <Card :class="cardAccent" data-testid="sale-customer-card">
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>
              {{
                isCredit
                  ? 'Credit Sales need a Customer Master entry with a phone number.'
                  : 'A Customer Master entry, or a walk-in captured on the Sale itself.'
              }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap items-end gap-4">
              <div v-if="!isCredit" class="grid gap-2">
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
                  <Input
                    v-model="walkinName"
                    placeholder="Name"
                    autofocus
                    data-testid="sale-walkin-name"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Place</Label>
                  <Input
                    v-model="walkinPlace"
                    placeholder="Place"
                    data-testid="sale-walkin-place"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Phone</Label>
                  <Input v-model="walkinPhone" placeholder="Optional" />
                </div>
              </template>
            </div>
            <p
              v-if="isCredit && selectedCustomer && !selectedCustomer.phone"
              class="mt-3 flex items-center gap-1.5 text-sm text-amber-600"
              data-testid="credit-phone-missing"
            >
              <AlertTriangle class="size-4" />
              {{ selectedCustomer.name }} has no phone number — add one before finishing.
            </p>
          </CardContent>
        </Card>

        <Card :class="cardAccent" data-testid="sale-goods-card">
          <CardHeader>
            <CardTitle>Goods</CardTitle>
          </CardHeader>
          <CardContent>
            <GoodsCart v-model="lines" :products="productList" :bag-types="bagTypes" />
          </CardContent>
        </Card>

        <Card :class="cardAccent" data-testid="sale-settle-card">
          <CardHeader>
            <CardTitle>Settle</CardTitle>
            <CardDescription>
              {{
                isCredit
                  ? 'Nothing is collected today — the signed Credit Voucher stands in for cash.'
                  : 'The cashier types UPI; cash covers the rest of the total.'
              }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-3">
                <label
                  class="flex items-center gap-2 text-sm"
                  data-testid="sale-apply-loading-label"
                >
                  <Checkbox
                    :model-value="applyLoading"
                    data-testid="sale-apply-loading"
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

              <div v-if="!isCredit" class="grid grid-cols-2 gap-2">
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
                <div class="grid gap-2">
                  <Label>Cash (auto)</Label>
                  <Input :model-value="cashDue" type="number" disabled data-testid="sale-cash" />
                </div>
              </div>
              <div v-else class="space-y-2" data-testid="credit-voucher-controls">
                <Button
                  variant="outline"
                  type="button"
                  data-testid="print-voucher"
                  @click="printVoucher"
                >
                  <Printer class="mr-2 size-4" />
                  Print Voucher
                </Button>
                <p
                  v-if="priceChangedSincePrint"
                  class="flex items-center gap-1.5 text-sm text-amber-600"
                  data-testid="voucher-price-changed"
                >
                  <AlertTriangle class="size-4" />
                  Price changed since the voucher was printed — reprint before finishing.
                </p>
                <p
                  v-else-if="voucherPrinted"
                  class="text-sm text-emerald-600"
                  data-testid="voucher-printed"
                >
                  Voucher printed at {{ formatRupees(printedAtTotal ?? 0) }} — ready to sign.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter class="justify-between border-t pt-4">
            <div>
              <p class="text-sm text-muted-foreground">Total</p>
              <p class="text-2xl font-semibold tabular-nums" data-testid="sale-total">
                {{ formatRupees(total) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <p v-if="error" class="text-sm text-destructive" data-testid="sale-error">
                {{ error }}
              </p>
              <Button size="lg" :class="finishTint" data-testid="sale-finish" @click="finish">
                {{ isCredit ? 'Finish — Credit' : 'Finish — Cash' }}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </template>

      <SlipPreview
        :open="slipOpen"
        :txn="finished"
        :printerless="settings?.printerlessMode ?? false"
        @update:open="(v) => (slipOpen = v)"
        @done="onSlipDone"
      />

      <!-- Voucher preview (front + back), printed at the current price for the customer to sign -->
      <CreditVoucherPreview
        :open="voucherOpen"
        :voucher-seq="printedVoucherSeq"
        :company-name="settings?.companyName ?? ''"
        :date="businessDay?.startDate ?? ''"
        :customer-name="selectedCustomerName"
        :place="selectedCustomerPlace"
        :amount="printedAtTotal ?? 0"
        :lines="voucherLines"
        :loading-charges="loadingCharge"
        :additional-charges="additionalCharges ?? 0"
        :total="printedAtTotal ?? total"
        @update:open="(v) => (voucherOpen = v)"
        @done="voucherOpen = false"
      />

      <!-- Finish blocked until a voucher is printed at the current price -->
      <Dialog :open="printGateOpen" @update:open="(v) => (printGateOpen = v)">
        <DialogContent class="sm:max-w-md" data-testid="voucher-gate">
          <DialogHeader>
            <DialogTitle>Print the Credit Voucher first</DialogTitle>
            <DialogDescription>
              {{
                priceChangedSincePrint
                  ? 'The price changed since the last print. Reprint the voucher at the current price so the customer signs the right amount.'
                  : 'A Credit Sale needs a signed voucher. Print it at the current price before finishing.'
              }}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" @click="printGateOpen = false">Cancel</Button>
            <Button type="button" data-testid="voucher-gate-print" @click="printVoucher">
              <Printer class="mr-2 size-4" />
              Print Voucher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </div>
</template>
