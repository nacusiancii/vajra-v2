<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Printer } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatBagKg, formatKgFromG, formatQty, formatRupees } from '@/lib/format'
import { lineMassGrams } from '@domain/transaction-rules'
import type { Txn } from '@domain/transaction'
import CreditVoucherPreview, { type VoucherLine } from './CreditVoucherPreview.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    txn: Txn | null
    /** When true the slip would be hand-copied (Printerless Mode, ADR-0008). */
    printerless: boolean
    companyName: string
    /** Business Day date as YYYY-MM-DD (voucher face). */
    date: string
    /**
     * Customer-facing counterparty name (ADR-0003): Telugu for master when set,
     * blank handwriting gap when missing; walk-in English as stored.
     */
    customerName?: string
    /** Customer-facing place (ADR-0003) — Telugu for master when set. */
    place?: string
    phone?: string
    /**
     * productId → customer-face product name (Telugu preferred, English fallback).
     */
    productFaceNames?: Record<number, string>
    /**
     * Print the Sale Invoice. Default on — invoice is helper paper; voucher always prints.
     */
    printInvoice?: boolean
    /**
     * Second invoice copy (business + customer). Default off on Credit finish (design #132).
     */
    printTwoCopies?: boolean
  }>(),
  {
    customerName: '',
    place: '',
    phone: '',
    productFaceNames: () => ({}),
    printInvoice: true,
    printTwoCopies: false
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:printInvoice': [value: boolean]
  'update:printTwoCopies': [value: boolean]
  done: []
}>()

const showVoucherBack = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) showVoucherBack.value = false
  }
)

const invoiceCopyCount = computed(() => {
  if (!props.printInvoice) return 0
  return props.printTwoCopies ? 2 : 1
})

const invoiceCopyLabel = computed(() => {
  if (!props.printInvoice) return 'Not printing'
  return props.printTwoCopies ? '2× print' : '1× print'
})

function lineProductName(productId: number, englishName: string): string {
  return props.productFaceNames[productId] || englishName
}

/** Voucher lines from the finished Sale (same cart as the invoice). */
const voucherLines = computed<VoucherLine[]>(() => {
  const t = props.txn
  if (!t) return []
  return t.lines.map((l) => ({
    productName: lineProductName(l.productId, l.productName),
    isLoose: l.isLoose,
    qty: l.qty,
    bagSizeG: l.bagSizeG,
    quintalRate: l.quintalRate,
    perKgRate: l.perKgRate,
    lineTotal: l.lineTotal
  }))
})

function setPrintInvoice(v: boolean | 'indeterminate'): void {
  const on = v === true
  emit('update:printInvoice', on)
  if (!on) emit('update:printTwoCopies', false)
}

function setPrintTwoCopies(v: boolean | 'indeterminate'): void {
  if (!props.printInvoice) return
  emit('update:printTwoCopies', v === true)
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent
      class="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden sm:max-w-4xl"
      data-testid="credit-finish-panel"
    >
      <DialogHeader class="shrink-0 space-y-2 text-left">
        <div class="flex flex-wrap items-center gap-2">
          <DialogTitle class="text-xl">Credit Sale ready</DialogTitle>
          <Badge
            v-if="txn"
            variant="secondary"
            class="font-mono tabular-nums"
            data-testid="credit-finish-sale-id"
          >
            {{ txn.id }}
          </Badge>
          <Badge
            v-if="txn"
            variant="outline"
            class="border-amber-400 font-mono tabular-nums text-amber-800 dark:text-amber-200"
            data-testid="credit-finish-voucher-id"
          >
            {{ txn.id }}
          </Badge>
        </div>
        <DialogDescription>
          Credit Voucher is the signed, locked paper that always prints. Sale Invoice is optional
          helper paper — the cashier may skip invoice copies entirely.
          <span v-if="printerless" class="mt-1 block">
            Printerless Mode is on — copy these details by hand.
          </span>
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="txn"
        class="mt-4 grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[1fr_minmax(16rem,20rem)]"
      >
        <!-- Left: print queue + Sale Invoice -->
        <div class="space-y-3">
          <div class="rounded-lg border bg-muted/20 p-3" data-testid="credit-finish-print-queue">
            <p
              class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Print queue
            </p>
            <div class="flex flex-wrap items-center gap-4">
              <label class="flex cursor-pointer items-center gap-2">
                <Checkbox
                  :model-value="printInvoice"
                  data-testid="credit-finish-print-invoice"
                  @update:model-value="setPrintInvoice"
                />
                <span class="text-sm font-medium">Print invoice</span>
              </label>
              <label
                class="flex items-center gap-2"
                :class="printInvoice ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
              >
                <Checkbox
                  :model-value="printTwoCopies"
                  :disabled="!printInvoice"
                  data-testid="credit-finish-two-copies"
                  @update:model-value="setPrintTwoCopies"
                />
                <span class="text-sm font-medium">Two copies</span>
                <span
                  class="rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
                  data-testid="credit-finish-2x-tag"
                >
                  2×
                </span>
              </label>
            </div>
          </div>

          <div
            class="relative rounded-md border bg-card p-4 text-sm transition-opacity"
            :class="printInvoice ? '' : 'opacity-40'"
            data-testid="sale-invoice"
          >
            <div
              class="absolute right-3 top-3 rounded-full border bg-background px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground"
              data-testid="slip-copy-count"
            >
              {{ invoiceCopyLabel }}
            </div>
            <div
              v-if="!printInvoice"
              class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
            >
              <span
                class="rounded-full border border-dashed bg-background/90 px-3 py-1 text-sm font-medium text-muted-foreground"
                data-testid="credit-finish-invoice-not-printing"
              >
                Not printing
              </span>
            </div>

            <div class="text-center">
              <p class="font-semibold">అమ్మకం రసీదు</p>
              <p class="text-xs uppercase tracking-widest text-muted-foreground">Sale Invoice</p>
            </div>
            <div class="mt-2 flex items-center justify-between">
              <span class="text-muted-foreground">Transaction ID</span>
              <span class="text-lg font-bold tabular-nums" data-testid="sale-number">{{
                txn.id
              }}</span>
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="shrink-0 text-muted-foreground">Customer</span>
              <span
                class="inline-block min-w-[10rem] text-right"
                :class="
                  !customerName.trim()
                    ? 'min-h-[1.25em] border-b border-dashed border-muted-foreground/50'
                    : ''
                "
                data-testid="slip-customer"
                >{{ customerName }}</span
              >
            </div>
            <div class="flex items-center justify-between gap-3">
              <span class="shrink-0 text-muted-foreground">Place</span>
              <span
                class="inline-block min-w-[10rem] text-right"
                :class="
                  !place.trim()
                    ? 'min-h-[1.25em] border-b border-dashed border-muted-foreground/50'
                    : ''
                "
                data-testid="slip-place"
                >{{ place }}</span
              >
            </div>
            <div class="flex items-center justify-between">
              <span class="text-muted-foreground">Phone</span>
              <span class="tabular-nums" data-testid="slip-phone">{{ phone.trim() || '—' }}</span>
            </div>
            <div
              class="flex items-center justify-between text-muted-foreground"
              data-testid="slip-copies"
            >
              <span>Copies</span>
              <span class="tabular-nums">{{ invoiceCopyCount }}</span>
            </div>
            <Separator class="my-2" />
            <div v-for="line in txn.lines" :key="line.id" class="flex justify-between gap-2 py-0.5">
              <span class="truncate" data-testid="slip-line-product">
                {{ lineProductName(line.productId, line.productName) }}
                <span
                  v-if="line.isLoose"
                  class="text-muted-foreground"
                  data-testid="slip-line-loose"
                >
                  ({{ formatQty(line.qty) }} kg × {{ formatRupees(line.perKgRate ?? 0) }}/kg)
                </span>
                <span v-else-if="line.bagSizeG" class="text-muted-foreground">
                  ({{ formatQty(line.qty) }} × {{ formatBagKg(line.bagSizeG) }} =
                  {{
                    formatKgFromG(
                      lineMassGrams({ isLoose: false, qty: line.qty, bagSizeG: line.bagSizeG })
                    )
                  }})
                </span>
                <span v-else class="text-muted-foreground">× {{ formatQty(line.qty) }}</span>
              </span>
              <span class="tabular-nums">{{ formatRupees(line.lineTotal) }}</span>
            </div>
            <Separator class="my-2" />
            <div
              v-if="txn.loadingCharges"
              class="flex justify-between text-muted-foreground"
              data-testid="slip-loading"
            >
              <span>Loading</span>
              <span class="tabular-nums">{{ formatRupees(txn.loadingCharges) }}</span>
            </div>
            <div v-if="txn.additionalCharges" class="flex justify-between text-muted-foreground">
              <span>Additional</span>
              <span class="tabular-nums">{{ formatRupees(txn.additionalCharges) }}</span>
            </div>
            <div
              v-if="txn.discountAmount"
              class="flex justify-between text-muted-foreground"
              data-testid="slip-discount"
            >
              <span>Discount</span>
              <span class="tabular-nums">−{{ formatRupees(txn.discountAmount) }}</span>
            </div>
            <div class="flex justify-between font-semibold">
              <span>Total</span>
              <span class="tabular-nums">{{ formatRupees(txn.total) }}</span>
            </div>
            <div class="mt-1 flex justify-between text-muted-foreground">
              <span>Pairs with Credit Voucher</span>
              <span class="tabular-nums" data-testid="slip-voucher-id">{{ txn.id }}</span>
            </div>
            <div v-if="txn.remarks" class="mt-2 border-t pt-2" data-testid="slip-remarks">
              <p class="text-muted-foreground">Remarks</p>
              <p class="whitespace-pre-wrap">{{ txn.remarks }}</p>
            </div>
          </div>
        </div>

        <!-- Right: Credit Voucher always prints -->
        <div
          class="rounded-lg border-2 border-amber-400 bg-amber-50/40 p-3 dark:bg-amber-950/30"
          data-testid="credit-finish-voucher-column"
        >
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p class="text-sm font-semibold">Credit Voucher</p>
              <p class="text-xs text-muted-foreground tabular-nums">
                {{ txn.id }} · {{ formatRupees(txn.total) }}
              </p>
            </div>
            <span
              class="rounded-full border border-amber-300 bg-background px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200"
              data-testid="credit-finish-voucher-will-print"
            >
              will print
            </span>
          </div>
          <CreditVoucherPreview
            v-model:show-back="showVoucherBack"
            collapsible-back
            :transaction-id="txn.id"
            :company-name="companyName"
            :date="date"
            :customer-name="customerName"
            :place="place"
            :phone="phone"
            :amount="txn.total"
            :lines="voucherLines"
            :loading-charges="txn.loadingCharges"
            :additional-charges="txn.additionalCharges"
            :discount-amount="txn.discountAmount"
            :total="txn.total"
          />
        </div>
      </div>

      <DialogFooter class="mt-4 shrink-0">
        <Button data-testid="credit-finish-done" @click="$emit('done')">
          <Printer class="mr-2 size-4" />
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
