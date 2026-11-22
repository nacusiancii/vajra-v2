<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Printer } from '@lucide/vue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
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
/** Set after a failed save: the next Done continues without the PDFs. */
const saveFailed = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) {
      showVoucherBack.value = false
      pdfResults.value = []
      saveFailed.value = false
    }
  }
)

/**
 * Done = print (ADR-0012: save PDFs). Two jobs: the voucher as one duplex sheet
 * (front, back), then the Quotation copies when ticked — so a Quotation never
 * lands on the voucher's back. Printerless Mode skips saving.
 */
async function onDone(): Promise<void> {
  const t = props.txn
  if (!t || props.printerless || saveFailed.value) {
    emit('done')
    return
  }
  const jobs: { kind: 'voucher' | 'quotation'; filename: string }[] = [
    { kind: 'voucher', filename: `${t.id}_voucher.pdf` }
  ]
  if (props.printInvoice) jobs.push({ kind: 'quotation', filename: `${t.id}_quotation.pdf` })
  if (await pdf.saveAll(jobs)) emit('done')
  else saveFailed.value = true
}

const quotationCopies = computed(() => (props.printTwoCopies ? 2 : 1))

/** What Done will print, in one line. */
const printSummary = computed(() => {
  if (!props.printInvoice) return 'Prints: voucher only'
  return `Prints: voucher + Quotation (${props.printTwoCopies ? '2 copies' : '1 copy'})`
})

const doneLabel = computed(() => {
  if (props.printerless) return 'Done'
  if (saveFailed.value) return 'Continue without PDF'
  return printing.value ? 'Saving…' : 'Print & finish'
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
      class="flex max-h-[92vh] w-full flex-col gap-0 overflow-hidden sm:max-w-[60rem]"
      data-testid="credit-finish-panel"
    >
      <DialogHeader class="shrink-0 text-left">
        <div class="flex flex-wrap items-center gap-2">
          <DialogTitle class="text-xl">Credit Sale ready</DialogTitle>
          <Badge
            v-if="txn"
            variant="outline"
            class="border-amber-400 font-mono tabular-nums text-amber-800 dark:text-amber-200"
            data-testid="credit-finish-sale-id"
          >
            {{ txn.id }}
          </Badge>
        </div>
      </DialogHeader>

      <!-- The Credit Voucher is the paper that matters: show it at full size. -->
      <div v-if="txn" class="mt-4 min-h-0 flex-1 overflow-y-auto">
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

      <p
        v-for="(r, i) in pdfResults.filter((x) => !x.ok)"
        :key="i"
        class="mt-3 break-all text-sm text-destructive"
        data-testid="credit-finish-pdf-error"
      >
        Could not save PDF: {{ r.ok ? '' : r.error }}
      </p>

      <DialogFooter class="mt-4 shrink-0 items-center gap-3 sm:justify-between">
        <!-- Print queue: the voucher always prints; the Quotation is the cashier's choice. -->
        <div
          v-if="!printerless"
          class="flex flex-wrap items-center gap-x-5 gap-y-2"
          data-testid="credit-finish-print-queue"
        >
          <label class="flex cursor-pointer items-center gap-2">
            <Checkbox
              :model-value="printInvoice"
              data-testid="credit-finish-print-invoice"
              @update:model-value="setPrintInvoice"
            />
            <span class="text-sm font-medium">Print Quotation</span>
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
          </label>
          <span class="text-xs text-muted-foreground" data-testid="slip-copy-count">
            {{ printSummary }}
          </span>
        </div>
        <span v-else />
        <Button :disabled="printing !== null" data-testid="credit-finish-done" @click="onDone">
          <Printer class="mr-2 size-4" />
          {{ doneLabel }}
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
