<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileDown, Printer } from '@lucide/vue'
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
import { Badge } from '@/components/ui/badge'
import { formatRupees } from '@/lib/format'
import type { Txn } from '@domain/transaction'
import { usePrintToPdf } from '@/lib/print-to-pdf'
import CreditVoucherPreview, { type VoucherLine } from './CreditVoucherPreview.vue'
import CreditVoucherSheet from './CreditVoucherSheet.vue'
import QuotationSheet from './QuotationSheet.vue'

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
     * Customer-facing counterparty name (ADR-0003): Telugu when set, else English;
     * walk-in English as stored on the Sale.
     */
    customerName?: string
    /** Customer-facing place (ADR-0003) — Telugu when set, else English. */
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
    /** Shop UPI ID for the voucher QR (Settings); no QR when blank. */
    upiId?: string
    /** Voucher interest clause: paise per ₹100 per month (Settings). */
    interestPaisePer100?: number
  }>(),
  {
    customerName: '',
    place: '',
    phone: '',
    productFaceNames: () => ({}),
    printInvoice: true,
    printTwoCopies: false,
    upiId: '',
    interestPaisePer100: 200
  }
)

const emit = defineEmits<{
  'update:open': [value: boolean]
  'update:printInvoice': [value: boolean]
  'update:printTwoCopies': [value: boolean]
  done: []
}>()

const showVoucherBack = ref(false)

const pdf = usePrintToPdf<'voucher' | 'quotation'>()
const { printing, results: pdfResults } = pdf

watch(
  () => props.open,
  (open) => {
    if (open) {
      showVoucherBack.value = false
      pdfResults.value = []
    }
  }
)

/**
 * Two PDFs, two print jobs (ADR-0012): the voucher as one duplex sheet (front,
 * back), then the Quotation copies when ticked — so a Quotation never lands on
 * the voucher's back.
 */
function savePdf(): void {
  const t = props.txn
  if (!t) return
  const jobs: { kind: 'voucher' | 'quotation'; filename: string }[] = [
    { kind: 'voucher', filename: `${t.id}_voucher.pdf` }
  ]
  if (props.printInvoice) jobs.push({ kind: 'quotation', filename: `${t.id}_quotation.pdf` })
  void pdf.save(jobs)
}

const quotationCopies = computed(() => (props.printTwoCopies ? 2 : 1))

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

      <div v-if="txn" class="mt-4 grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-2">
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
            class="relative overflow-auto rounded-md border transition-opacity"
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

            <QuotationSheet
              :txn="txn"
              :company-name="companyName"
              :date="date"
              :customer-name="customerName"
              :place="place"
              :phone="phone"
              :product-face-names="productFaceNames"
            />
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
            :lines="voucherLines"
            :loading-charges="txn.loadingCharges"
            :additional-charges="txn.additionalCharges"
            :discount-amount="txn.discountAmount"
            :total="txn.total"
            :upi-id="upiId"
            :interest-paise-per100="interestPaisePer100"
          />
        </div>
      </div>

      <p
        v-for="(r, i) in pdfResults"
        :key="i"
        class="mt-3 break-all text-sm"
        :class="r.ok ? 'text-muted-foreground' : 'text-destructive'"
        data-testid="credit-finish-pdf-result"
      >
        {{ r.ok ? `Saved ${r.path}` : `Could not save PDF: ${r.error}` }}
      </p>

      <DialogFooter class="mt-4 shrink-0">
        <Button
          variant="outline"
          :disabled="printing !== null"
          data-testid="credit-finish-save-pdf"
          @click="savePdf"
        >
          <FileDown class="mr-2 size-4" />
          Save PDF
        </Button>
        <Button data-testid="credit-finish-done" @click="$emit('done')">
          <Printer class="mr-2 size-4" />
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Print layouts: mounted one job at a time; main.css shows only this on paper. -->
  <Teleport v-if="printing === 'voucher' && txn" to="body">
    <div class="print-root">
      <CreditVoucherSheet
        v-for="side in ['front', 'back'] as const"
        :key="side"
        :side="side"
        :transaction-id="txn.id"
        :company-name="companyName"
        :date="date"
        :customer-name="customerName"
        :place="place"
        :phone="phone"
        :lines="voucherLines"
        :loading-charges="txn.loadingCharges"
        :additional-charges="txn.additionalCharges"
        :discount-amount="txn.discountAmount"
        :total="txn.total"
        :upi-id="upiId"
        :interest-paise-per100="interestPaisePer100"
      />
    </div>
  </Teleport>
  <Teleport v-if="printing === 'quotation' && txn" to="body">
    <div class="print-root">
      <QuotationSheet
        v-for="n in quotationCopies"
        :key="n"
        :txn="txn"
        :company-name="companyName"
        :date="date"
        :customer-name="customerName"
        :place="place"
        :phone="phone"
        :product-face-names="productFaceNames"
      />
    </div>
  </Teleport>
</template>
