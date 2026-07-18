<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertTriangle, Banknote, FileSignature, Save, ShoppingCart, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import GoodsCart from '@/components/transaction/GoodsCart.vue'
import { emptyCartLine, type CartLine } from '@/components/transaction/cart-line'
import SlipPreview from '@/components/transaction/SlipPreview.vue'
import CreditFinishPanel from '@/components/transaction/CreditFinishPanel.vue'
import SettleReceiptStack from '@/components/transaction/SettleReceiptStack.vue'
import { loadingChargeBuckets } from '@/components/transaction/loading-buckets'
import CustomerSelect from '@/components/customer/CustomerSelect.vue'
import { Checkbox } from '@/components/ui/checkbox'
import { useProductsQuery } from '@/queries/products'
import { useCustomersQuery } from '@/queries/customers'
import { useSettingsQuery, useBusinessDayQuery } from '@/queries/operations'
import { useClearDraft, useCreateSale, useEditSale, useSaveSaleDraft } from '@/queries/transactions'
import {
  computeLoadingCharge,
  grandTotal,
  lineTotal,
  validateSale
} from '@domain/transaction-rules'
import { validateSaleDraftCounterparty, type SaleDraftPayload } from '@domain/draft'
import NumericField from '@/components/NumericField.vue'
import { formatRupees } from '@/lib/format'
import { formatMoneyDomain } from '@/lib/numeric-field'
import { userFacingError } from '@/lib/utils'
import { normalizeWalkin, type CreateSaleInput, type SaleMode, type Txn } from '@domain/transaction'
import type { LineProductLookup } from '@domain/transaction-rules'
import {
  isWalkinTxn,
  slipFaceCustomerName,
  slipFacePlace,
  slipFaceProductName
} from '@domain/slip-face'

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))
const resumeDraftQuery = computed(() =>
  typeof route.query.draft === 'string' ? Number(route.query.draft) : null
)

/** Mode from first-screen entry point (`?mode=cash|credit`). Edit/Draft hydrate override. */
function modeFromQuery(): SaleMode | null {
  const m = route.query.mode
  if (m === 'cash' || m === 'credit') return m
  return null
}

const { data: products } = useProductsQuery()
const { data: customers } = useCustomersQuery()
const { data: settings } = useSettingsQuery()
const { data: businessDay } = useBusinessDayQuery()
const createSale = useCreateSale()
const editSale = useEditSale()
const saveSaleDraft = useSaveSaleDraft()
const clearDraftMut = useClearDraft()

/** When set, this cart is a parked Draft (resume or after Save). Not used on Edit Sale. */
const activeDraftId = ref<number | null>(null)
/** Id already applied into the cart — prevents query re-fires from wiping dirty edits. */
const draftHydratedId = ref<number | null>(null)

// Cash Sale opens with Walk-in selected by default (CONTEXT.md Walk-in Customer).
// Credit snaps to Customer Master via the mode watch below.
const counterpartyMode = ref<'customer' | 'walkin'>('walkin')
const customerId = ref<number | null>(null)
const walkinName = ref('')
const walkinPlace = ref('')
const walkinPhone = ref('')

// Cash or Credit is pre-chosen on the first screen (query `mode`) or hydrated from
// Edit / Draft. The in-cart toggle can still flip it. null only while Edit/Draft load.
const mode = ref<SaleMode | null>(
  editId.value || resumeDraftQuery.value != null ? null : (modeFromQuery() ?? 'cash')
)
// New cart: one blank goods row so the cashier can type immediately (no Add Line).
// Edit / Draft start empty and hydrate; do not reseed if the blank is removed.
const lines = ref<CartLine[]>(
  editId.value || resumeDraftQuery.value != null ? [] : [emptyCartLine()]
)
const goodsCart = ref<InstanceType<typeof GoodsCart> | null>(null)
const applyLoading = ref(false)
const additionalCharges = ref<number | null>(null)
/** Sale Discount (paise) — simple rupee reduction of total; not Settlement Discount. */
const discountAmount = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const remarks = ref('')

const error = ref<string | null>(null)
const finished = ref<Txn | null>(null)
/** Cash Sale Invoice slip after finish. */
const slipOpen = ref(false)
/** Credit Sale finish panel (invoice + voucher together). */
const creditFinishOpen = ref(false)
/**
 * Cash Sale Invoice customer copy — on by default (business + customer = two printouts).
 * Cashier may opt out during the Sale before finish (ADR-0008 / CONTEXT Sale Invoice).
 */
const printCustomerCopy = ref(true)
/**
 * Credit finish panel: Print invoice (default on) and two copies (default off) — #132 design.
 * Voucher always prints once with the same transaction ID as the invoice.
 */
const creditPrintInvoice = ref(true)
const creditPrintTwoCopies = ref(false)

// Customer Master pick → first product line only when that line is still empty.
watch(customerId, (id) => {
  if (id != null) goodsCart.value?.ensureLineAndFocusProduct()
})

const productList = computed(() => products.value ?? [])
const customerList = computed(() => customers.value ?? [])
const bagTypes = computed(() => settings.value?.bagTypes ?? [25_000, 30_000, 50_000])

const isCredit = computed(() => mode.value === 'credit')

/**
 * Choose Cash or Credit (mid-cart toggle; Home pre-sets via query `mode`).
 * Cash → Walk-in by default when no Customer Master entry is selected.
 * Credit → always Customer Master (walk-in fields keep values if the cashier flips back).
 */
function setSaleMode(m: SaleMode): void {
  mode.value = m
  if (m === 'credit') {
    counterpartyMode.value = 'customer'
  } else if (customerId.value == null) {
    counterpartyMode.value = 'walkin'
  }
}

// Credit from Home (`?mode=credit`) or any path that assigns mode without setSaleMode —
// never leave walk-in selected on Credit (walk-in fields keep values if cashier flips back).
watch(
  mode,
  (m) => {
    if (m === 'credit' && counterpartyMode.value === 'walkin') counterpartyMode.value = 'customer'
  },
  { immediate: true }
)

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
  for (const p of productList.value) map.set(p.id, { defaultBagSizeG: p.defaultBagSizeG })
  return map
})

const lineTotals = computed(() =>
  lines.value.map((l) => {
    if (!l.productId || !l.qty) return 0
    return lineTotal({
      isLoose: l.isLoose,
      qty: l.qty,
      bagSizeG: l.bagSizeG,
      quintalRate: l.quintalRate,
      perKgRate: l.perKgRate
    })
  })
)

const loadingLineInputs = computed(() =>
  lines.value.map((l) => ({
    isLoose: l.isLoose,
    bagSizeG: l.bagSizeG,
    qty: l.qty ?? 0
  }))
)

const loadingRules = computed(
  () => settings.value?.loadingCharge ?? { breakpoints: [], aboveLastPaise: 0 }
)

const loadingBuckets = computed(() =>
  loadingChargeBuckets(loadingLineInputs.value, loadingRules.value)
)

const loadingCharge = computed(() => {
  if (!applyLoading.value) return 0
  return computeLoadingCharge(loadingLineInputs.value, loadingRules.value)
})

const goodsTotal = computed(() => lineTotals.value.reduce((a, b) => a + b, 0))

const total = computed(() =>
  grandTotal(
    lineTotals.value,
    loadingCharge.value,
    additionalCharges.value ?? 0,
    discountAmount.value ?? 0
  )
)

// Cash is whatever the total isn't covered by UPI — the cashier only types UPI.
const cashDue = computed(() => Math.max(total.value - (upiCollected.value ?? 0), 0))

/**
 * Customer-facing face fields for Sale Invoice / Credit Voucher (ADR-0003).
 * Master → Telugu when present, else English. Walk-in → English on the Sale.
 * Product lines prefer Telugu and fall back to English. Phone stays English
 * from Customer Master / walk-in as today (CONTEXT / #77).
 */
const finishedInvoiceCustomer = computed(() => {
  const t = finished.value
  if (!t) return ''
  const walkin = isWalkinTxn(t)
  const master = t.customerId != null ? customerList.value.find((c) => c.id === t.customerId) : null
  return slipFaceCustomerName({
    isWalkin: walkin,
    walkinName: t.walkinName,
    nameTe: master?.nameTe ?? null,
    nameEn: master?.name ?? t.customerName ?? null
  })
})
const finishedInvoicePlace = computed(() => {
  const t = finished.value
  if (!t) return ''
  const walkin = isWalkinTxn(t)
  if (walkin) {
    return slipFacePlace({
      isWalkin: true,
      walkinPlace: t.walkinPlace,
      placeTe: null,
      placeEn: null
    })
  }
  const master = customerList.value.find((c) => c.id === t.customerId)
  return slipFacePlace({
    isWalkin: false,
    walkinPlace: null,
    placeTe: master?.placeTe ?? null,
    placeEn: master?.placeName ?? null
  })
})
const finishedInvoicePhone = computed(() => {
  const t = finished.value
  if (!t) return ''
  if (t.customerId != null) {
    return customerList.value.find((c) => c.id === t.customerId)?.phone ?? ''
  }
  return t.walkinPhone ?? ''
})
/** productId → customer-face product name for slip / voucher lines. */
const finishedProductFaceNames = computed(() => {
  const map: Record<number, string> = {}
  for (const p of productList.value) {
    map[p.id] = slipFaceProductName(p.name, p.nameTe)
  }
  return map
})

function buildInput(m: SaleMode): CreateSaleInput {
  return {
    mode: m,
    customerId: counterpartyMode.value === 'customer' ? customerId.value : null,
    walkin:
      counterpartyMode.value === 'walkin'
        ? normalizeWalkin({
            name: walkinName.value,
            place: walkinPlace.value,
            phone: walkinPhone.value.trim() || null
          })
        : null,
    lines: lines.value
      .filter((l) => l.productId != null)
      .map((l) => ({
        productId: l.productId as number,
        isLoose: l.isLoose,
        bagSizeG: l.bagSizeG,
        quintalRate: l.quintalRate,
        perKgRate: l.perKgRate,
        qty: l.qty ?? 0
      })),
    additionalCharges: additionalCharges.value ?? 0,
    loadingCharges: loadingCharge.value,
    loadingApplied: applyLoading.value,
    discountAmount: discountAmount.value ?? 0,
    cashCollected: m === 'cash' ? cashDue.value : 0,
    upiCollected: m === 'cash' ? (upiCollected.value ?? 0) : 0,
    // Sequence is assigned at commit; invoice + voucher share it on the finish panel.
    reservedSeq: null,
    remarks: remarks.value.trim() || null
  }
}

function buildDraftPayload(m: SaleMode): SaleDraftPayload {
  return {
    mode: m,
    counterpartyMode: counterpartyMode.value,
    customerId: counterpartyMode.value === 'customer' ? customerId.value : null,
    walkinName: walkinName.value,
    walkinPlace: walkinPlace.value,
    walkinPhone: walkinPhone.value,
    lines: lines.value.map((l) => ({
      productId: l.productId,
      isLoose: l.isLoose,
      bagSizeG: l.bagSizeG,
      quintalRate: l.quintalRate,
      perKgRate: l.perKgRate,
      qty: l.qty
    })),
    applyLoading: applyLoading.value,
    additionalCharges: additionalCharges.value,
    discountAmount: discountAmount.value,
    upiCollected: upiCollected.value,
    remarks: remarks.value
  }
}

function applyDraftPayload(payload: SaleDraftPayload): void {
  mode.value = payload.mode
  counterpartyMode.value = payload.counterpartyMode
  customerId.value = payload.customerId
  walkinName.value = payload.walkinName
  walkinPlace.value = payload.walkinPlace
  walkinPhone.value = payload.walkinPhone
  lines.value = payload.lines.map((l) => ({ ...l }))
  applyLoading.value = payload.applyLoading
  additionalCharges.value = payload.additionalCharges
  // Older parked payloads may omit discountAmount — treat as empty.
  discountAmount.value = payload.discountAmount ?? null
  upiCollected.value = payload.upiCollected
  remarks.value = payload.remarks
}

function saveDraft(): void {
  const m = mode.value
  if (!m || editId.value) return
  error.value = null
  const payload = buildDraftPayload(m)
  const reason = validateSaleDraftCounterparty(payload)
  if (reason) {
    error.value = reason
    return
  }
  saveSaleDraft.mutate(
    { id: activeDraftId.value, payload },
    {
      onSuccess: () => {
        // Parked — leave the cart so the cashier can start other counter work from Home.
        void router.push('/')
      },
      onError: (err) => {
        error.value = userFacingError(err, 'Could not save Draft')
      }
    }
  )
}

function clearActiveDraft(): void {
  error.value = null
  const id = activeDraftId.value
  if (id == null) return
  clearDraftMut.mutate(id, {
    onSuccess: () => {
      activeDraftId.value = null
      draftHydratedId.value = null
      void router.push('/')
    },
    onError: (err) => {
      error.value = userFacingError(err, 'Could not clear Draft')
    }
  })
}

/** After a successful Sale, drop any parked Draft and open the finish preview. */
function finishWithDraftCleanup(txn: Txn): void {
  const draftId = activeDraftId.value
  const showFinish = (): void => {
    finished.value = txn
    if (txn.saleMode === 'credit') {
      // Credit finish defaults: Print on, two copies off (design #132).
      creditPrintInvoice.value = true
      creditPrintTwoCopies.value = false
      creditFinishOpen.value = true
    } else {
      slipOpen.value = true
    }
  }
  if (draftId == null) {
    showFinish()
    return
  }
  clearDraftMut.mutate(draftId, {
    onSuccess: () => {
      activeDraftId.value = null
      draftHydratedId.value = null
      showFinish()
    },
    onError: () => {
      // Sale already committed — still show finish; Draft may linger until Clear.
      activeDraftId.value = null
      draftHydratedId.value = null
      showFinish()
    }
  })
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
  if (reason) {
    error.value = reason
    return
  }
  const preDiscount = grandTotal(
    lineTotals.value,
    loadingCharge.value,
    additionalCharges.value ?? 0,
    0
  )
  if ((discountAmount.value ?? 0) > preDiscount) {
    error.value = 'Discount cannot exceed the Sale total'
    return
  }

  if (editId.value) {
    editSale.mutate({ id: editId.value, input }, { onSuccess: finishWithDraftCleanup })
  } else {
    createSale.mutate(input, { onSuccess: finishWithDraftCleanup })
  }
}

function onSlipDone(): void {
  slipOpen.value = false
  void router.push('/')
}

function onCreditFinishDone(): void {
  creditFinishOpen.value = false
  void router.push('/')
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
    discountAmount.value = txn.discountAmount || null
    // Rehydrate opt-in from the persisted flag — not from amount (₹0 free-band stays on).
    applyLoading.value = txn.loadingApplied
    upiCollected.value = txn.upiIn || null
    remarks.value = txn.remarks ?? ''
    lines.value = txn.lines.map((l) => ({
      productId: l.productId,
      isLoose: l.isLoose,
      bagSizeG: l.bagSizeG,
      quintalRate: l.quintalRate,
      perKgRate: l.perKgRate,
      qty: l.qty
    }))
  },
  { immediate: true }
)

// Resume a Sale Draft — replaces any open cart without auto-save or a conflict dialog.
watch(
  resumeDraftQuery,
  async (id) => {
    if (editId.value || id == null || Number.isNaN(id) || draftHydratedId.value === id) return
    const draft = await window.api.getDraft(id)
    if (!draft || draft.type !== 'SA') {
      error.value = 'Draft not found'
      return
    }
    applyDraftPayload(draft.payload)
    activeDraftId.value = draft.id
    draftHydratedId.value = draft.id
    error.value = null
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
            {{ editId ? 'Edit Sale' : activeDraftId != null ? 'Sale Draft' : 'New Sale' }}
          </h1>
        </div>

        <!-- Mode pre-chosen from Home; stays flippable mid-cart -->
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
            @click="setSaleMode('cash')"
          >
            <Banknote class="size-4" />
            Cash
          </button>
          <button
            type="button"
            :class="segmentClass('credit')"
            data-testid="sale-mode-credit"
            @click="setSaleMode('credit')"
          >
            <FileSignature class="size-4" />
            Credit
          </button>
        </div>
      </div>

      <!-- The workspace: three cards that adapt to the chosen mode -->
      <template v-if="mode">
        <Card :class="cardAccent" data-testid="sale-customer-card">
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>
              {{
                isCredit
                  ? 'Credit Sales need a Customer Master entry with a phone number.'
                  : 'A Customer Master entry, or a walk-in (name and place optional).'
              }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-4">
              <!-- Row 1: mode selector alone so Place/Phone never orphan it mid-row -->
              <div v-if="!isCredit" class="grid gap-2">
                <Label>Customer</Label>
                <Select v-model="counterpartyMode">
                  <SelectTrigger class="w-[180px]" data-testid="sale-counterparty-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">Customer Master</SelectItem>
                    <SelectItem value="walkin">Walk in</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <!-- Row 2: master picker or walk-in fields -->
              <CustomerSelect
                v-if="counterpartyMode === 'customer'"
                v-model="customerId"
                :auto-focus="true"
                test-id="sale-customer"
                label="Select customer"
              />

              <div v-else class="flex flex-wrap items-end gap-4">
                <div class="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    v-model="walkinName"
                    placeholder="Optional"
                    autofocus
                    data-testid="sale-walkin-name"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Place</Label>
                  <Input
                    v-model="walkinPlace"
                    placeholder="Optional"
                    data-testid="sale-walkin-place"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Phone</Label>
                  <Input v-model="walkinPhone" placeholder="Optional" />
                </div>
              </div>
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
            <GoodsCart
              ref="goodsCart"
              v-model="lines"
              :products="productList"
              :bag-types="bagTypes"
            />
          </CardContent>
        </Card>

        <Card :class="cardAccent" data-testid="sale-settle-card">
          <CardHeader>
            <CardTitle>Settle</CardTitle>
            <CardDescription>
              {{
                isCredit
                  ? 'Nothing is collected today — finish prints the Credit Voucher (and optional Sale Invoice).'
                  : 'The cashier types UPI; cash covers the rest of the total.'
              }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid gap-4 sm:grid-cols-2">
              <SettleReceiptStack
                :apply-loading="applyLoading"
                :loading-charge="loadingCharge"
                :goods-total="goodsTotal"
                :additional-charges="additionalCharges"
                :discount-amount="discountAmount"
                :buckets="loadingBuckets"
                @update:apply-loading="applyLoading = $event"
                @update:additional-charges="additionalCharges = $event"
                @update:discount-amount="discountAmount = $event"
              />

              <div v-if="!isCredit" class="grid grid-cols-2 gap-2">
                <div class="grid gap-2">
                  <Label>UPI</Label>
                  <NumericField
                    mode="money"
                    :model-value="upiCollected"
                    placeholder="0"
                    test-id="sale-upi"
                    @update:model-value="upiCollected = $event"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Cash (auto)</Label>
                  <Input
                    :model-value="formatMoneyDomain(cashDue)"
                    type="text"
                    disabled
                    class="tabular-nums"
                    data-testid="sale-cash"
                  />
                </div>
              </div>
              <div
                v-else
                class="rounded-md border border-dashed border-amber-300 bg-amber-50/40 p-3 text-sm text-muted-foreground dark:bg-amber-950/20"
                data-testid="credit-settle-hint"
              >
                On finish, the Credit Voucher always prints once (same transaction ID as the
                invoice). Sale Invoice print and copy count are chosen on the finish panel.
              </div>

              <!-- Cash Sale Invoice: two copies by default; opt out of the customer copy (ADR-0008) -->
              <div
                v-if="!isCredit"
                class="sm:col-span-2 rounded-md border bg-muted/20 p-3"
                data-testid="sale-invoice-copies"
              >
                <label class="flex cursor-pointer items-start gap-2">
                  <Checkbox
                    class="mt-0.5"
                    :model-value="printCustomerCopy"
                    data-testid="sale-print-customer-copy"
                    @update:model-value="printCustomerCopy = $event === true"
                  />
                  <span class="min-w-0 flex-1 text-sm">
                    <span class="block font-medium">Customer copy</span>
                    <span class="mt-0.5 block text-xs text-muted-foreground">
                      Two invoice printouts by default (business + customer). Uncheck for business
                      copy only.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <div class="mt-4 grid gap-2">
              <Label for="sale-remarks">Remarks</Label>
              <Input
                id="sale-remarks"
                v-model="remarks"
                placeholder="Optional"
                data-testid="sale-remarks"
              />
            </div>
          </CardContent>
          <CardFooter class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div>
              <p class="text-sm text-muted-foreground">Total</p>
              <p class="text-2xl font-semibold tabular-nums" data-testid="sale-total">
                {{ formatRupees(total) }}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-3">
              <p v-if="error" class="text-sm text-destructive" data-testid="sale-error">
                {{ error }}
              </p>
              <template v-if="!editId">
                <Button
                  variant="outline"
                  type="button"
                  data-testid="sale-save-draft"
                  :disabled="saveSaleDraft.isPending.value"
                  @click="saveDraft"
                >
                  <Save class="mr-2 size-4" />
                  {{ activeDraftId != null ? 'Update Draft' : 'Save Draft' }}
                </Button>
                <Button
                  v-if="activeDraftId != null"
                  variant="outline"
                  type="button"
                  data-testid="sale-clear-draft"
                  :disabled="clearDraftMut.isPending.value"
                  @click="clearActiveDraft"
                >
                  <Trash2 class="mr-2 size-4" />
                  Clear Draft
                </Button>
              </template>
              <Button size="lg" :class="finishTint" data-testid="sale-finish" @click="finish">
                {{ isCredit ? 'Finish — Credit' : 'Finish — Cash' }}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </template>

      <!-- Cash finish: Sale Invoice slip only -->
      <SlipPreview
        :open="slipOpen"
        :txn="finished"
        :printerless="settings?.printerlessMode ?? true"
        :customer-name="finishedInvoiceCustomer"
        :place="finishedInvoicePlace"
        :phone="finishedInvoicePhone"
        :product-face-names="finishedProductFaceNames"
        :print-customer-copy="printCustomerCopy"
        @update:open="(v) => (slipOpen = v)"
        @done="onSlipDone"
      />

      <!-- Credit finish: invoice + voucher together (Print on / two copies off by default) -->
      <CreditFinishPanel
        :open="creditFinishOpen"
        :txn="finished"
        :printerless="settings?.printerlessMode ?? true"
        :company-name="settings?.companyName ?? ''"
        :date="businessDay?.startDate ?? ''"
        :customer-name="finishedInvoiceCustomer"
        :place="finishedInvoicePlace"
        :phone="finishedInvoicePhone"
        :product-face-names="finishedProductFaceNames"
        :print-invoice="creditPrintInvoice"
        :print-two-copies="creditPrintTwoCopies"
        @update:open="(v) => (creditFinishOpen = v)"
        @update:print-invoice="(v) => (creditPrintInvoice = v)"
        @update:print-two-copies="(v) => (creditPrintTwoCopies = v)"
        @done="onCreditFinishDone"
      />
    </div>
  </div>
</template>
