<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Banknote, FileSignature, Save, Trash2, Truck } from '@lucide/vue'
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
import GoodsCart, { type CartLine } from '@/components/transaction/GoodsCart.vue'
import CustomerSelect from '@/components/customer/CustomerSelect.vue'
import { useProductsQuery } from '@/queries/products'
import {
  useClearDraft,
  useCreatePurchase,
  useEditPurchase,
  useSavePurchaseDraft
} from '@/queries/transactions'
import {
  grandTotal,
  lineTotal,
  validatePurchase,
  type LineProductLookup
} from '@domain/transaction-rules'
import { validatePurchaseDraftCounterparty, type PurchaseDraftPayload } from '@domain/draft'
import { formatRupees } from '@/lib/format'
import { parseRupeesInput, paiseInputValue } from '@/lib/money-input'
import { userFacingError } from '@/lib/utils'
import type { CreatePurchaseInput, SaleMode } from '@domain/transaction'

const route = useRoute()
const router = useRouter()
const editId = computed(() => (typeof route.query.edit === 'string' ? route.query.edit : null))
const resumeDraftQuery = computed(() =>
  typeof route.query.draft === 'string' ? Number(route.query.draft) : null
)

const { data: products } = useProductsQuery()
const createPurchase = useCreatePurchase()
const editPurchase = useEditPurchase()
const savePurchaseDraft = useSavePurchaseDraft()
const clearDraftMut = useClearDraft()

/** When set, this cart is a parked Draft (resume or after Save). Not used on Edit Purchase. */
const activeDraftId = ref<number | null>(null)
/** Id already applied into the cart — prevents query re-fires from wiping dirty edits. */
const draftHydratedId = ref<number | null>(null)

const counterpartyMode = ref<'customer' | 'walkin'>('customer')
const customerId = ref<number | null>(null)
const walkinName = ref('')
const walkinPlace = ref('')
const walkinPhone = ref('')

// Cash or Credit is chosen before anything else — the whole workspace hangs off it.
// null = the gate is still showing; editing an existing Purchase prefills it instead.
const mode = ref<SaleMode | null>(null)
const lines = ref<CartLine[]>([])
const goodsCart = ref<InstanceType<typeof GoodsCart> | null>(null)
const additionalCharges = ref<number | null>(null)
const upiCollected = ref<number | null>(null)
const remarks = ref('')
const error = ref<string | null>(null)

// Supplier picked on an empty cart → first goods line + product dropdown.
watch(customerId, (id) => {
  if (id != null) goodsCart.value?.ensureLineAndFocusProduct()
})

const productList = computed(() => products.value ?? [])

const isCredit = computed(() => mode.value === 'credit')

// Cash is the common case — the gate pre-focuses its tile so a bare Enter starts a Cash Purchase.
const cashTile = ref<HTMLButtonElement | null>(null)
onMounted(() => cashTile.value?.focus())

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

const productLookup = computed(() => {
  const map = new Map<number, LineProductLookup>()
  for (const p of productList.value)
    map.set(p.id, { type: p.type, defaultBagSizeG: p.defaultBagSizeG })
  return map
})

const total = computed(() => {
  const lineTotals = lines.value.map((l) => {
    const p = l.productId == null ? undefined : productLookup.value.get(l.productId)
    if (!p || !l.qty) return 0
    return lineTotal({
      productType: p.type,
      qty: l.qty,
      bagSizeG: l.bagSizeG,
      quintalRate: l.quintalRate,
      unitRate: l.unitRate,
      isLoose: l.isLoose
    })
  })
  return grandTotal(lineTotals, 0, additionalCharges.value ?? 0)
})

// Cashier types UPI paid; cash paid is the remainder of the total.
const cashDue = computed(() => Math.max(total.value - (upiCollected.value ?? 0), 0))

function buildInput(m: SaleMode): CreatePurchaseInput {
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
        isLoose: l.isLoose,
        bagSizeG: l.bagSizeG,
        quintalRate: l.quintalRate,
        unitRate: l.unitRate,
        qty: l.qty ?? 0
      })),
    additionalCharges: additionalCharges.value ?? 0,
    cashCollected: m === 'cash' ? cashDue.value : 0,
    upiCollected: m === 'cash' ? (upiCollected.value ?? 0) : 0,
    remarks: remarks.value.trim() || null
  }
}

function buildDraftPayload(m: SaleMode): PurchaseDraftPayload {
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
      unitRate: l.unitRate,
      qty: l.qty
    })),
    additionalCharges: additionalCharges.value,
    upiCollected: upiCollected.value,
    remarks: remarks.value
  }
}

function applyDraftPayload(payload: PurchaseDraftPayload): void {
  mode.value = payload.mode
  counterpartyMode.value = payload.counterpartyMode
  customerId.value = payload.customerId
  walkinName.value = payload.walkinName
  walkinPlace.value = payload.walkinPlace
  walkinPhone.value = payload.walkinPhone
  lines.value = payload.lines.map((l) => ({ ...l }))
  additionalCharges.value = payload.additionalCharges
  upiCollected.value = payload.upiCollected
  remarks.value = payload.remarks
}

function saveDraft(): void {
  const m = mode.value
  if (!m || editId.value) return
  error.value = null
  const payload = buildDraftPayload(m)
  const reason = validatePurchaseDraftCounterparty(payload)
  if (reason) {
    error.value = reason
    return
  }
  savePurchaseDraft.mutate(
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

/** After a successful create Purchase, drop any parked Draft and return Home. */
function finishWithDraftCleanup(): void {
  const draftId = activeDraftId.value
  const goHome = (): void => {
    void router.push('/')
  }
  if (draftId == null) {
    goHome()
    return
  }
  clearDraftMut.mutate(draftId, {
    onSuccess: () => {
      activeDraftId.value = null
      draftHydratedId.value = null
      goHome()
    },
    onError: () => {
      // Purchase already committed — still leave; Draft may linger until Clear.
      activeDraftId.value = null
      draftHydratedId.value = null
      goHome()
    }
  })
}

function finish(): void {
  const m = mode.value
  if (!m) return
  error.value = null
  const input = buildInput(m)
  if (counterpartyMode.value === 'walkin' && !walkinName.value.trim()) {
    error.value = 'Walk-in Purchases need a supplier name'
    return
  }
  const reason = validatePurchase(input.lines, productLookup.value)
  if (reason) {
    error.value = reason
    return
  }
  if (editId.value) {
    editPurchase.mutate({ id: editId.value, input }, { onSuccess: finishWithDraftCleanup })
  } else {
    createPurchase.mutate(input, { onSuccess: finishWithDraftCleanup })
  }
}

// Prefill when editing an existing Purchase.
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
      isLoose: l.isLoose,
      bagSizeG: l.bagSizeG,
      quintalRate: l.quintalRate,
      unitRate: l.unitRate,
      qty: l.qty
    }))
  },
  { immediate: true }
)

// Resume a Purchase Draft — replaces any open cart without auto-save or a conflict dialog.
watch(
  resumeDraftQuery,
  async (id) => {
    if (editId.value || id == null || Number.isNaN(id) || draftHydratedId.value === id) return
    const draft = await window.api.getDraft(id)
    if (!draft || draft.type !== 'PU') {
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
    data-testid="purchase-page"
  >
    <div class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <Truck class="size-6" />
          <h1 class="text-2xl font-semibold tracking-tight">
            {{
              editId ? 'Edit Purchase' : activeDraftId != null ? 'Purchase Draft' : 'New Purchase'
            }}
          </h1>
        </div>

        <!-- Mode stays flippable mid-cart; the segmented control mirrors the gate's choice -->
        <div
          v-if="mode"
          class="inline-flex items-center rounded-lg border bg-background p-1"
          role="group"
          aria-label="Purchase mode"
          data-testid="purchase-mode"
        >
          <button
            type="button"
            :class="segmentClass('cash')"
            data-testid="purchase-mode-cash"
            @click="mode = 'cash'"
          >
            <Banknote class="size-4" />
            Cash
          </button>
          <button
            type="button"
            :class="segmentClass('credit')"
            data-testid="purchase-mode-credit"
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
        data-testid="purchase-gate"
      >
        <p class="text-sm text-muted-foreground sm:col-span-2">
          How does this Purchase settle? Supplier, goods, and payment all follow from this.
        </p>
        <button
          ref="cashTile"
          type="button"
          class="flex flex-col items-start gap-2 rounded-xl border-2 border-emerald-200 bg-card p-6 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-emerald-900 dark:hover:bg-emerald-950/40"
          data-testid="purchase-gate-cash"
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
            Cash and/or UPI paid to the supplier at finish. Customer Master entry or walk-in.
          </span>
        </button>
        <button
          type="button"
          class="flex flex-col items-start gap-2 rounded-xl border-2 border-amber-200 bg-card p-6 text-left transition-colors hover:border-amber-500 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:border-amber-900 dark:hover:bg-amber-950/40"
          data-testid="purchase-gate-credit"
          @click="mode = 'credit'"
        >
          <FileSignature class="size-8 text-amber-600" />
          <span class="text-xl font-semibold">Credit</span>
          <span class="text-sm text-muted-foreground">
            Goods received on credit — owed to the supplier; settle later via a Payment.
          </span>
        </button>
      </div>

      <!-- The workspace: three cards that adapt to the chosen mode -->
      <template v-else-if="mode">
        <Card :class="cardAccent" data-testid="purchase-supplier-card">
          <CardHeader>
            <CardTitle>Supplier</CardTitle>
            <CardDescription>
              A Customer Master entry, or a walk-in supplier captured on the Purchase itself.
            </CardDescription>
          </CardHeader>
          <CardContent>
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

              <div v-if="counterpartyMode === 'customer'" class="grid gap-2">
                <Label>Select supplier</Label>
                <CustomerSelect
                  v-model="customerId"
                  :auto-focus="true"
                  test-id="purchase-customer"
                />
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
                  <Input
                    v-model="walkinPlace"
                    placeholder="Optional"
                    data-testid="purchase-walkin-place"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Phone</Label>
                  <Input v-model="walkinPhone" placeholder="Optional" />
                </div>
              </template>
            </div>
          </CardContent>
        </Card>

        <Card :class="cardAccent" data-testid="purchase-goods-card">
          <CardHeader>
            <CardTitle>Goods</CardTitle>
          </CardHeader>
          <CardContent>
            <GoodsCart ref="goodsCart" v-model="lines" :products="productList" />
          </CardContent>
        </Card>

        <Card :class="cardAccent" data-testid="purchase-settle-card">
          <CardHeader>
            <CardTitle>Settle</CardTitle>
            <CardDescription>
              {{
                isCredit
                  ? 'Nothing is paid today — goods received on credit; settle later via a Payment.'
                  : 'The cashier types UPI; cash covers the rest of the total.'
              }}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="grid max-w-xs gap-2">
                <Label>Additional Charges</Label>
                <Input
                  type="number"
                  min="0"
                  :model-value="paiseInputValue(additionalCharges)"
                  placeholder="0"
                  data-testid="purchase-additional"
                  @update:model-value="additionalCharges = parseRupeesInput($event)"
                />
              </div>

              <div v-if="!isCredit" class="grid grid-cols-2 gap-2">
                <div class="grid gap-2">
                  <Label>UPI</Label>
                  <Input
                    type="number"
                    min="0"
                    :model-value="paiseInputValue(upiCollected)"
                    placeholder="0"
                    data-testid="purchase-upi"
                    @update:model-value="upiCollected = parseRupeesInput($event)"
                  />
                </div>
                <div class="grid gap-2">
                  <Label>Cash (auto)</Label>
                  <Input
                    :model-value="paiseInputValue(cashDue)"
                    type="number"
                    disabled
                    data-testid="purchase-cash"
                  />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter class="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div>
              <p class="text-sm text-muted-foreground">Total cost</p>
              <p class="text-2xl font-semibold tabular-nums" data-testid="purchase-total">
                {{ formatRupees(total) }}
              </p>
            </div>
            <div class="flex flex-wrap items-center justify-end gap-3">
              <p v-if="error" class="text-sm text-destructive" data-testid="purchase-error">
                {{ error }}
              </p>
              <template v-if="!editId">
                <Button
                  variant="outline"
                  type="button"
                  data-testid="purchase-save-draft"
                  :disabled="savePurchaseDraft.isPending.value"
                  @click="saveDraft"
                >
                  <Save class="mr-2 size-4" />
                  {{ activeDraftId != null ? 'Update Draft' : 'Save Draft' }}
                </Button>
                <Button
                  v-if="activeDraftId != null"
                  variant="outline"
                  type="button"
                  data-testid="purchase-clear-draft"
                  :disabled="clearDraftMut.isPending.value"
                  @click="clearActiveDraft"
                >
                  <Trash2 class="mr-2 size-4" />
                  Clear Draft
                </Button>
              </template>
              <Button size="lg" :class="finishTint" data-testid="purchase-finish" @click="finish">
                {{ isCredit ? 'Record — Credit' : 'Record — Cash' }}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </template>
    </div>
  </div>
</template>
