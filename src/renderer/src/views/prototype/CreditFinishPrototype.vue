<script setup lang="ts">
/**
 * PROTOTYPE ONLY — throwaway host for Credit Sale finish dual-panel layouts (#115 / #78).
 * Sub-shape B: dedicated route with mock data (read-only). No real mutations.
 *
 * C-iteration question: On Variant C’s master-detail shell, how should Credit Sale
 * finish present optional Sale Invoice printing (compact multi-copy control) while
 * Credit Voucher stays locked / always prints?
 *
 * Keys C1|C2|C3 = print-control structural treatments on the C shell.
 * Legacy A|B|C kept for prior comparison (A/B shells; C defaults to C1 controls).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PrototypeSwitcher, {
  type PrototypeVariantMeta
} from '@/components/prototype/PrototypeSwitcher.vue'
import { MOCK_CREDIT_FINISH } from './credit-finish/mockData'
import VariantASideBySide from './credit-finish/VariantASideBySide.vue'
import VariantBStackedTabs from './credit-finish/VariantBStackedTabs.vue'
import VariantCMasterDetail from './credit-finish/VariantCMasterDetail.vue'

const VARIANTS: PrototypeVariantMeta[] = [
  { key: 'C1', name: 'C shell · Print invoice + 2x' },
  { key: 'C2', name: 'C shell · segmented No|1|2' },
  { key: 'C3', name: 'C shell · voucher-first chip' },
  { key: 'A', name: 'Legacy · side-by-side' },
  { key: 'B', name: 'Legacy · stacked tabs' },
  { key: 'C', name: 'Legacy C → same as C1' }
]

const route = useRoute()
const data = MOCK_CREDIT_FINISH

type VariantKey = 'C1' | 'C2' | 'C3' | 'A' | 'B' | 'C'

const variantKey = computed((): VariantKey => {
  const q = route.query.variant
  const raw = Array.isArray(q) ? q[0] : q
  if (raw === 'C1' || raw === 'C2' || raw === 'C3' || raw === 'A' || raw === 'B' || raw === 'C') {
    return raw
  }
  return 'C1'
})

const cPrintStyle = computed((): 'C1' | 'C2' | 'C3' => {
  if (variantKey.value === 'C2') return 'C2'
  if (variantKey.value === 'C3') return 'C3'
  // C1 and legacy C
  return 'C1'
})

const isCFamily = computed(
  () =>
    variantKey.value === 'C1' ||
    variantKey.value === 'C2' ||
    variantKey.value === 'C3' ||
    variantKey.value === 'C'
)
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4 px-6 py-8" data-testid="prototype-credit-finish-page">
    <div class="space-y-1">
      <p
        class="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400"
      >
        Prototype · throwaway · #115 · C-iteration
      </p>
      <h1 class="text-2xl font-semibold tracking-tight">
        Credit Sale finish — optional invoice print
      </h1>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Master-detail shell (winner C) with three print-control treatments. Credit Voucher is locked
        will-print; Sale Invoice is optional. Mock Credit Sale · Sale No.
        {{ data.saleSeq }} ≡ Voucher No. {{ data.voucherSeq }}. Use
        <code class="rounded bg-muted px-1 text-xs">?variant=C1|C2|C3</code>
        or the bar below. Not production finish.
      </p>
    </div>

    <!-- Dim backdrop so the dialog feels like the real finish surface -->
    <div
      class="relative min-h-[70vh] rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4"
      data-testid="prototype-stage"
    >
      <p class="mb-4 text-center text-xs text-muted-foreground">
        Mock counter backdrop · dialog opens automatically
      </p>

      <VariantASideBySide v-if="variantKey === 'A'" :data="data" />
      <VariantBStackedTabs v-else-if="variantKey === 'B'" :data="data" />
      <VariantCMasterDetail
        v-else-if="isCFamily"
        :key="cPrintStyle"
        :data="data"
        :print-style="cPrintStyle"
      />
    </div>

    <PrototypeSwitcher :variants="VARIANTS" />
  </div>
</template>
