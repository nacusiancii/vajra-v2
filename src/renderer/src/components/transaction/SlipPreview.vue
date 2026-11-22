<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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
import type { Txn } from '@domain/transaction'
import type { SavePdfResult } from '@shared/api'
import { useSavePdf } from '@/queries/operations'
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

defineEmits<{ 'update:open': [value: boolean]; done: [] }>()

/** Business + customer when opted in; business only when the cashier opts out. */
const copyCount = computed(() => (props.printCustomerCopy ? 2 : 1))
const copyLabel = computed(() =>
  props.printCustomerCopy ? '2 copies (business + customer)' : '1 copy (business only)'
)

/** True only while the print layout is mounted for the PDF call. */
const printing = ref(false)
const pdfResult = ref<SavePdfResult | null>(null)
const savePdfMutation = useSavePdf()

watch(
  () => props.open,
  (open) => {
    if (open) pdfResult.value = null
  }
)

/** One PDF page per copy, saved to the prints folder and opened (ADR-0012). */
async function savePdf(): Promise<void> {
  if (!props.txn || printing.value) return
  printing.value = true
  try {
    await nextTick()
    pdfResult.value = await savePdfMutation.mutateAsync(`${props.txn.id}_quotation.pdf`)
  } finally {
    printing.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-md" data-testid="slip-preview">
      <DialogHeader>
        <DialogTitle>
          {{ printerless ? 'Write a manual copy' : 'Quotation preview' }}
        </DialogTitle>
        <DialogDescription>
          {{
            printerless
              ? 'No printer yet — save a PDF, or copy these details by hand.'
              : 'This is what will print.'
          }}
          <span class="mt-1 block" data-testid="slip-copy-count">{{ copyLabel }}</span>
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
        v-if="pdfResult"
        class="break-all text-sm"
        :class="pdfResult.ok ? 'text-muted-foreground' : 'text-destructive'"
        data-testid="slip-pdf-result"
      >
        {{ pdfResult.ok ? `Saved ${pdfResult.path}` : `Could not save PDF: ${pdfResult.error}` }}
      </p>

      <DialogFooter>
        <Button variant="outline" :disabled="printing" data-testid="slip-save-pdf" @click="savePdf">
          <FileDown class="mr-2 size-4" />
          Save PDF
        </Button>
        <Button data-testid="slip-done" @click="$emit('done')">
          <Printer class="mr-2 size-4" />
          Done
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Print layout: mounted only during savePdf; main.css shows only this on paper. -->
  <Teleport v-if="printing && txn" to="body">
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
