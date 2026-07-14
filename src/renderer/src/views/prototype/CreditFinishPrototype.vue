<script setup lang="ts">
/**
 * PROTOTYPE ONLY — throwaway host for Credit Sale finish dual-panel layouts (#115 / #78).
 * Sub-shape B: dedicated route with mock data (read-only). No real mutations.
 *
 * Question: What should the Credit Sale finish surface look like with two full
 * previews (Sale Invoice + Credit Voucher) instead of one invoice and a folded voucher line?
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
  { key: 'A', name: 'Side-by-side equal columns' },
  { key: 'B', name: 'Stacked tabs / steps' },
  { key: 'C', name: 'Master-detail (invoice + voucher rail)' }
]

const route = useRoute()
const data = MOCK_CREDIT_FINISH

const variantKey = computed(() => {
  const q = route.query.variant
  const raw = Array.isArray(q) ? q[0] : q
  if (raw === 'B' || raw === 'C') return raw
  return 'A'
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-4 px-6 py-8" data-testid="prototype-credit-finish-page">
    <div class="space-y-1">
      <p
        class="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400"
      >
        Prototype · throwaway · #115
      </p>
      <h1 class="text-2xl font-semibold tracking-tight">Credit Sale finish — dual panels</h1>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Exploring layouts for finish-time Sale Invoice + Credit Voucher (both full previews). Mock
        Credit Sale · Sale No. {{ data.saleSeq }} ≡ Voucher No. {{ data.voucherSeq }}. Use
        <code class="rounded bg-muted px-1 text-xs">?variant=A|B|C</code> or the bar below. Not
        production finish — Cash Sale and real commit path are untouched.
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
      <VariantCMasterDetail v-else :data="data" />
    </div>

    <PrototypeSwitcher :variants="VARIANTS" />
  </div>
</template>
