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
import type { Txn } from '@domain/transaction'
import { usePrintToPdf } from '@/lib/print-to-pdf'
import QuotationSheet from './QuotationSheet.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    txn: Txn | null
    /** When true the slip would be hand-copied (Printerless Mode, ADR-0008). */
    printerless: boolean
    companyName?: string
    /** Business Day date as YYYY-MM-DD. */
    date?: string
    /**
     * Customer-facing counterparty name (ADR-0003): Telugu when set, else English;
     * walk-in English as stored on the Sale.
     */
    customerName?: string
    /**
     * Customer-facing place (ADR-0003): Telugu when set, else English;
     * walk-in English place as stored.
     */
    place?: string
    /** Counterparty phone when known. Blank when absent (same as Credit Voucher). */
    phone?: string
    /**
     * productId → customer-face product name (Telugu preferred, English fallback).
     * Lines fall back to ledger English productName when an id is absent.
     */
    productFaceNames?: Record<number, string>
    /** Extra customer copy of the Quotation (ADR-0008). Default on → two copies. */
    printCustomerCopy?: boolean
  }>(),
  {
    companyName: '',
    date: '',
    customerName: '',
    place: '',
    phone: '',
    productFaceNames: () => ({}),
    printCustomerCopy: true
  }
)

/** Business + customer when opted in; business only when the cashier opts out. */
const copyCount = computed(() => (props.printCustomerCopy ? 2 : 1))
const copyLabel = computed(() =>
  props.printCustomerCopy ? '2 copies (business + customer)' : '1 copy (business only)'
)

const emit = defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

const pdf = usePrintToPdf<'quotation'>()
const { printing, results: pdfResults } = pdf
/** Set after a failed save: the next Done continues without the PDF. */
const saveFailed = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) {
      pdfResults.value = []
      saveFailed.value = false
    }
  }
)

/** Done = print (ADR-0012): one PDF page per copy. Printerless Mode skips saving. */
async function onDone(): Promise<void> {
  if (!props.txn || props.printerless || saveFailed.value) {
    emit('done')
    return
  }
  const ok = await pdf.saveAll([{ kind: 'quotation', filename: `${props.txn.id}_quotation.pdf` }])
  if (ok) emit('done')
  else saveFailed.value = true
}

const doneLabel = computed(() => {
  if (props.printerless) return 'Done'
  if (saveFailed.value) return 'Continue without PDF'
  return printing.value ? 'Saving…' : 'Print & finish'
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md" data-testid="slip-preview">
      <DialogHeader>
        <DialogTitle>
          {{ printerless ? 'Write a manual copy' : 'Cash Sale ready' }}
        </DialogTitle>
        <DialogDescription>
          <span v-if="printerless" class="block"
            >Printerless Mode — copy these details by hand.</span
          >
          <span class="block" data-testid="slip-copy-count">{{ copyLabel }}</span>
        </DialogDescription>
      </DialogHeader>

      <div v-if="txn" class="max-h-[60vh] overflow-auto rounded-md border">
        <QuotationSheet
          class="mx-auto"
          data-testid="sale-invoice"
          :txn="txn"
          :company-name="companyName"
          :date="date"
          :customer-name="customerName"
          :place="place"
          :phone="phone"
          :product-face-names="productFaceNames"
        />
      </div>

      <p
        v-for="(r, i) in pdfResults.filter((x) => !x.ok)"
        :key="i"
        class="break-all text-sm text-destructive"
        data-testid="slip-pdf-error"
      >
        Could not save PDF: {{ r.ok ? '' : r.error }}
      </p>

      <DialogFooter>
        <Button :disabled="printing !== null" data-testid="slip-done" @click="onDone">
          <Printer class="mr-2 size-4" />
          {{ doneLabel }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Print layout: mounted only during savePdf; main.css shows only this on paper. -->
  <Teleport v-if="printing === 'quotation' && txn" to="body">
    <div class="print-root">
      <QuotationSheet
        v-for="n in copyCount"
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
