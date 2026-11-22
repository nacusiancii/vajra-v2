<script setup lang="ts">
import { computed } from 'vue'
import QRCode from 'qrcode'
import { formatQty, formatRupees, formatSlipDate } from '@/lib/format'
import { amountInWords } from '@domain/amount-in-words'
import { upiPayUri } from '@domain/upi'
import { QUINTAL_G } from '@domain/units'

export interface VoucherLine {
  productName: string
  isLoose: boolean
  qty: number
  bagSizeG: number | null
  quintalRate: number | null
  perKgRate: number | null
  lineTotal: number
}

/**
 * One side of the Credit Voucher as it lands on paper: a 10 cm × 21 cm upright
 * sheet (ADR-0012). Front = tear-off stub + the voucher the customer signs,
 * modelled on the shop's pre-printed credit pad. Back = the chosen products.
 * The same component is the on-screen preview and the PDF page.
 */
const props = defineProps<{
  side: 'front' | 'back'
  /** Shared with the Quotation (ADR-0009). */
  transactionId: string | null
  companyName: string
  /** Business Day date as YYYY-MM-DD. */
  date: string
  customerName: string
  place: string
  phone: string
  lines: VoucherLine[]
  loadingCharges: number
  additionalCharges: number
  /** Sale Discount in paise (0 when none). */
  discountAmount: number
  /** Amount owed, after Discount (paise). */
  total: number
  /** Shop UPI ID for the QR; no QR when blank. */
  upiId: string
  /** Interest clause: paise per ₹100 per month. */
  interestPaisePer100: number
}>()

const displayDate = computed(() => formatSlipDate(props.date))
const amountWords = computed(() => amountInWords(props.total))

/** Pad style: ₹2 → "2-00". */
const interestText = computed(() => {
  const p = props.interestPaisePer100
  return `${Math.floor(p / 100)}-${String(p % 100).padStart(2, '0')}`
})

/** QR as an SVG path, built synchronously so it is ready when the PDF is taken. */
const qr = computed(() => {
  if (!props.upiId.trim()) return null
  const { modules } = QRCode.create(upiPayUri(props.upiId, props.companyName), {
    errorCorrectionLevel: 'M'
  })
  let d = ''
  for (let y = 0; y < modules.size; y++) {
    for (let x = 0; x < modules.size; x++) {
      if (modules.get(y, x)) d += `M${x} ${y}h1v1h-1z`
    }
  }
  return { size: modules.size, d }
})

/** Bag lines: bags × quintals per bag × Quintal Rate. Loose: kg × price/kg. */
function formula(line: VoucherLine): string {
  const qty = formatQty(line.qty)
  if (line.isLoose) return `${qty} kg × ${formatRupees(line.perKgRate ?? 0)}/kg`
  if (line.bagSizeG) {
    return `${qty} × ${formatQty(line.bagSizeG / QUINTAL_G)} × ${formatRupees(line.quintalRate ?? 0)}`
  }
  return qty
}
</script>

<template>
  <div
    v-if="side === 'front'"
    class="voucher-sheet flex flex-col bg-white p-[6mm] text-[11px] leading-snug text-black"
    data-testid="voucher-front"
  >
    <!-- Tear-off stub: stays with the shop's book -->
    <div class="space-y-1" data-testid="voucher-stub">
      <div class="flex justify-between">
        <span
          >No <span class="font-semibold tabular-nums">{{ transactionId ?? '—' }}</span></span
        >
        <span>తేది {{ displayDate }}</span>
      </div>
      <p>వ్రాసి యిచ్చినవారు: {{ customerName }}</p>
      <p>గ్రామం: {{ place.trim() || '—' }}</p>
      <p>
        మొత్తం: <span class="font-semibold tabular-nums">{{ formatRupees(total) }}</span>
      </p>
      <p>చెల్లించిన తేది: ....................</p>
    </div>

    <div class="my-3 border-t border-dashed border-black text-center text-[9px]">
      <span class="relative -top-2 bg-white px-1">✂</span>
    </div>

    <!-- The voucher the customer signs -->
    <div class="flex flex-1 flex-col space-y-1">
      <div class="flex justify-between">
        <span
          >No
          <span class="font-semibold tabular-nums" data-testid="voucher-number">{{
            transactionId ?? '—'
          }}</span></span
        >
        <span
          >తేది <span data-testid="voucher-date">{{ displayDate }}</span></span
        >
      </div>
      <div class="text-center">
        <p class="text-sm font-bold" data-testid="voucher-company">
          {{ companyName.trim() || '—' }}
        </p>
        <p class="font-semibold">క్రెడిట్ వోచర్ · Credit Voucher</p>
      </div>
      <p>
        వ్రాసి యిచ్చినవారు:
        <span class="font-semibold" data-testid="voucher-customer">{{ customerName }}</span>
      </p>
      <p>
        గ్రామం: <span data-testid="voucher-place">{{ place.trim() || '—' }}</span>
      </p>
      <p>
        Mobile:
        <span class="tabular-nums" data-testid="voucher-phone">{{ phone.trim() || '—' }}</span>
      </p>
      <p>
        రూ.
        <span class="text-sm font-bold tabular-nums" data-testid="voucher-amount">{{
          formatRupees(total)
        }}</span>
      </p>
      <p>
        అక్షరముల: <span class="font-semibold" data-testid="voucher-words">{{ amountWords }}</span>
      </p>
      <p data-testid="voucher-interest">
        ఈ రోజు నా / మా వ్యాపార అవసరార్థం పై మొత్తం అప్పుగా తీసుకున్నాను / తీసుకున్నాము. ఇందుకు వడ్డీ
        నెల 1కి రూ. 100కి రూ. {{ interestText }} లు చొప్పున ఇచ్చే షరతుపై మీ ఖాతాకు జమ
        వ్రాయించగలవారము.
      </p>

      <div class="mt-auto flex items-end justify-between gap-2 pt-2">
        <svg
          v-if="qr"
          class="size-[24mm] shrink-0"
          :viewBox="`-2 -2 ${qr.size + 4} ${qr.size + 4}`"
          shape-rendering="crispEdges"
          data-testid="voucher-qr"
        >
          <rect x="-2" y="-2" :width="qr.size + 4" :height="qr.size + 4" fill="white" />
          <path :d="qr.d" fill="black" />
        </svg>
        <span v-else />
        <p class="text-right">
          ......................................<br />
          సంతకం
        </p>
      </div>
    </div>
  </div>

  <div
    v-else
    class="voucher-sheet bg-white p-[6mm] text-[11px] leading-snug text-black"
    data-testid="voucher-back"
  >
    <p class="text-center font-semibold">
      {{ transactionId ?? '—' }} · {{ customerName }} · {{ displayDate }}
    </p>
    <div class="my-2 border-t border-black" />
    <div
      v-for="(line, idx) in lines"
      :key="idx"
      class="border-b border-dashed border-black/40 py-1 last:border-0"
      data-testid="voucher-line"
    >
      <p class="font-medium">{{ line.productName }}</p>
      <p class="flex justify-between gap-2 tabular-nums">
        <span>{{ formula(line) }}</span>
        <span class="font-medium">= {{ formatRupees(line.lineTotal) }}</span>
      </p>
    </div>
    <div class="my-2 border-t border-black" />
    <div v-if="loadingCharges" class="flex justify-between" data-testid="voucher-loading">
      <span>Loading</span><span class="tabular-nums">{{ formatRupees(loadingCharges) }}</span>
    </div>
    <div v-if="additionalCharges" class="flex justify-between" data-testid="voucher-additional">
      <span>Additional</span><span class="tabular-nums">{{ formatRupees(additionalCharges) }}</span>
    </div>
    <div v-if="discountAmount" class="flex justify-between" data-testid="voucher-discount">
      <span>Discount</span><span class="tabular-nums">−{{ formatRupees(discountAmount) }}</span>
    </div>
    <div class="flex justify-between text-sm font-bold" data-testid="voucher-total">
      <span>Total</span><span class="tabular-nums">{{ formatRupees(total) }}</span>
    </div>
  </div>
</template>

<style scoped>
/* Paper size: 10 cm wide × 21 cm tall, upright (ADR-0012). */
.voucher-sheet {
  width: 100mm;
  min-height: 210mm;
  box-sizing: border-box;
}
</style>
