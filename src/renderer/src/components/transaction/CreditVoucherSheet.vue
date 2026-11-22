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
 * One side of the Credit Voucher as it lands on paper: a 21 cm × 10 cm landscape
 * sheet (ADR-0012), modelled on the shop's pre-printed credit pad.
 *
 * Front: tear-off stub on the left, perforation, the voucher the customer signs.
 * Back: the chosen products behind the voucher only. The sheet turns over
 * sideways (duplex "flip on short edge"), so the back of the stub is on the
 * right — that strip stays blank and the perforation is drawn there too.
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
    class="voucher-sheet flex bg-white text-[10px] leading-snug text-black"
    data-testid="voucher-front"
  >
    <!-- Tear-off stub: stays with the shop's book -->
    <div class="voucher-stub space-y-1.5 p-[5mm]" data-testid="voucher-stub">
      <p>
        No <span class="font-semibold tabular-nums">{{ transactionId ?? '—' }}</span>
      </p>
      <p>వ్రాసి యిచ్చినవారు: {{ customerName }}</p>
      <p>గ్రామం: {{ place.trim() || '—' }}</p>
      <p>తేది: {{ displayDate }}</p>
      <p>
        మొత్తం: <span class="font-semibold tabular-nums">{{ formatRupees(total) }}</span>
      </p>
      <p>చెల్లించిన తేది: ..............</p>
    </div>

    <div class="voucher-perforation" />

    <!-- The voucher the customer signs: three blocks spread over the height -->
    <div class="flex min-w-0 flex-1 flex-col justify-between p-[5mm] text-[11px]">
      <div class="space-y-1">
        <div class="flex items-baseline justify-between gap-2">
          <span
            >No
            <span class="font-semibold tabular-nums" data-testid="voucher-number">{{
              transactionId ?? '—'
            }}</span></span
          >
          <span class="text-base font-bold">చేవుత్తరము</span>
          <span
            >తేది <span data-testid="voucher-date">{{ displayDate }}</span></span
          >
        </div>
        <p>
          వ్రాయించుకున్నవారు:
          <span class="font-semibold" data-testid="voucher-company">{{
            companyName.trim() || '—'
          }}</span>
        </p>
        <p>
          వ్రాసి యిచ్చినవారు:
          <span class="font-semibold" data-testid="voucher-customer">{{ customerName }}</span>
        </p>
        <p class="flex gap-8">
          <span
            >గ్రామం: <span data-testid="voucher-place">{{ place.trim() || '—' }}</span></span
          >
          <span
            >ఫోన్ నం.:
            <span class="tabular-nums" data-testid="voucher-phone">{{
              phone.trim() || '—'
            }}</span></span
          >
        </p>
      </div>

      <!-- The pad's printed sentence, word for word; amount and words sit inside it. -->
      <p class="text-[12px] leading-[1.8]" data-testid="voucher-interest">
        ఈ రోజు నా / మా వ్యాపార అభివృద్ధి నిమిత్తం నీ తావున అప్పుగా తీసుకున్న రొఖ్ఖం రూ.
        <span class="font-bold tabular-nums" data-testid="voucher-amount">{{
          formatRupees(total)
        }}</span>
        అక్షరముల
        <span class="font-semibold" data-testid="voucher-words">{{ amountWords }}</span>
        ఇచ్చినారు గనుక నాకు / మాకు ముట్టినవి. ఇందుకు వడ్డీ నెల 1కి రూ. 100కి రూ.
        {{ interestText }} లు చొప్పున యిచ్చే పద్ధతిలో మీ ఖాతాకు జమ వ్రాయించగల వారము.
      </p>

      <div class="flex items-end justify-between gap-3">
        <p class="text-sm">
          రూ. <span class="font-bold tabular-nums">{{ formatRupees(total) }}</span>
        </p>
        <!-- QR says what it is: a UPI payment to the shop, nothing else. -->
        <div v-if="qr" class="flex items-center gap-2">
          <svg
            class="size-[20mm] shrink-0"
            :viewBox="`-2 -2 ${qr.size + 4} ${qr.size + 4}`"
            shape-rendering="crispEdges"
            data-testid="voucher-qr"
          >
            <rect x="-2" y="-2" :width="qr.size + 4" :height="qr.size + 4" fill="white" />
            <path :d="qr.d" fill="black" />
          </svg>
          <div class="text-[10px] leading-snug" data-testid="voucher-qr-caption">
            <p class="font-semibold">చెల్లించుటకు స్కాన్ చేయండి</p>
            <p>Scan to pay by UPI</p>
            <p>PhonePe · Google Pay · Paytm</p>
            <p class="font-semibold">{{ upiId.trim() }}</p>
          </div>
        </div>
        <p class="text-right">
          ..............................................<br />
          సంతకం
        </p>
      </div>
    </div>
  </div>

  <div
    v-else
    class="voucher-sheet flex bg-white text-[10px] leading-snug text-black"
    data-testid="voucher-back"
  >
    <!-- Behind the voucher: the chosen products -->
    <div class="min-w-0 flex-1 p-[5mm]">
      <p class="text-center font-semibold">
        {{ transactionId ?? '—' }} · {{ customerName }} · {{ displayDate }}
      </p>
      <div class="my-1.5 border-t border-black" />
      <div
        v-for="(line, idx) in lines"
        :key="idx"
        class="flex justify-between gap-2 border-b border-dashed border-black/40 py-0.5 last:border-0"
        data-testid="voucher-line"
      >
        <span class="min-w-0 truncate font-medium">{{ line.productName }}</span>
        <span class="shrink-0 tabular-nums"
          >{{ formula(line) }} = {{ formatRupees(line.lineTotal) }}</span
        >
      </div>
      <div class="my-1.5 border-t border-black" />
      <div v-if="loadingCharges" class="flex justify-between" data-testid="voucher-loading">
        <span>Loading</span><span class="tabular-nums">{{ formatRupees(loadingCharges) }}</span>
      </div>
      <div v-if="additionalCharges" class="flex justify-between" data-testid="voucher-additional">
        <span>Additional</span
        ><span class="tabular-nums">{{ formatRupees(additionalCharges) }}</span>
      </div>
      <div v-if="discountAmount" class="flex justify-between" data-testid="voucher-discount">
        <span>Discount</span><span class="tabular-nums">−{{ formatRupees(discountAmount) }}</span>
      </div>
      <div class="flex justify-between text-sm font-bold" data-testid="voucher-total">
        <span>Total</span><span class="tabular-nums">{{ formatRupees(total) }}</span>
      </div>
    </div>

    <div class="voucher-perforation" />

    <!-- Back of the stub: left blank so it tears off clean -->
    <div class="voucher-stub" data-testid="voucher-back-stub" />
  </div>
</template>

<style scoped>
/* Paper size: 21 cm wide × 10 cm tall, landscape (ADR-0012). */
.voucher-sheet {
  width: 210mm;
  height: 100mm;
  box-sizing: border-box;
  overflow: hidden;
  page: voucher;
}

/* Stub strip: same width on both sides so the perforations line up. */
.voucher-stub {
  width: 55mm;
  flex-shrink: 0;
}

.voucher-perforation {
  flex-shrink: 0;
  border-left: 1px dashed black;
}
</style>
