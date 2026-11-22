<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Settings as SettingsIcon, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import NumericField from '@/components/NumericField.vue'
import { useSettingsQuery, useUpdateSettings } from '@/queries/operations'
import { loadingChargeForKg, type AppSettings, type LoadingChargeRules } from '@domain/settings'
import { gToKg, kgToG, type BagSizeG } from '@domain/units'
import { formatBagKg, formatRupees } from '@/lib/format'

const { data: settings } = useSettingsQuery()
const updateSettings = useUpdateSettings()

const draft = ref<AppSettings | null>(null)
/** New bag size typed in kg (cashier unit). */
const newBagSizeKg = ref<number | null>(null)
const saved = ref(false)

/** Test weight in kg — uses in-form (unsaved) breakpoints. */
const testWeightKg = ref<number | null>(null)

watch(
  settings,
  (s) => {
    if (s && !draft.value) draft.value = JSON.parse(JSON.stringify(s)) as AppSettings
  },
  { immediate: true }
)

const loadingRules = computed((): LoadingChargeRules => {
  return (
    draft.value?.loadingCharge ?? {
      breakpoints: [],
      aboveLastPaise: 0
    }
  )
})

const testChargePaise = computed(() => {
  const kg = testWeightKg.value
  if (kg == null || !(kg > 0)) return null
  return loadingChargeForKg(kg, loadingRules.value)
})

function bpUpToKg(index: number): number | null {
  return draft.value?.loadingCharge.breakpoints[index]?.upToKg ?? null
}

function setBpUpToKg(index: number, kg: number | null): void {
  if (!draft.value) return
  const bp = draft.value.loadingCharge.breakpoints[index]
  if (bp) bp.upToKg = kg ?? 0
}

function bpChargePaise(index: number): number | null {
  return draft.value?.loadingCharge.breakpoints[index]?.chargePaise ?? null
}

function setBpChargePaise(index: number, paise: number | null): void {
  if (!draft.value) return
  const bp = draft.value.loadingCharge.breakpoints[index]
  if (bp) bp.chargePaise = paise ?? 0
}

function aboveLastPaise(): number | null {
  return draft.value?.loadingCharge.aboveLastPaise ?? null
}

function setAboveLastPaise(paise: number | null): void {
  if (draft.value) draft.value.loadingCharge.aboveLastPaise = paise ?? 0
}

function addBreakpoint(): void {
  if (!draft.value) return
  const bps = draft.value.loadingCharge.breakpoints
  const lastUp = bps.length ? bps[bps.length - 1]!.upToKg : 0
  draft.value.loadingCharge.breakpoints = [...bps, { upToKg: lastUp + 10, chargePaise: 0 }]
}

function removeBreakpoint(index: number): void {
  if (!draft.value) return
  draft.value.loadingCharge.breakpoints = draft.value.loadingCharge.breakpoints.filter(
    (_, i) => i !== index
  )
}

function addBagType(): void {
  const kg = newBagSizeKg.value
  if (!draft.value || !kg || kg <= 0) return
  const sizeG = kgToG(kg) as BagSizeG
  if (!draft.value.bagTypes.includes(sizeG)) {
    draft.value.bagTypes = [...draft.value.bagTypes, sizeG].sort((a, b) => a - b)
  }
  newBagSizeKg.value = null
}

function removeBagType(sizeG: number): void {
  if (draft.value) draft.value.bagTypes = draft.value.bagTypes.filter((b) => b !== sizeG)
}

function save(): void {
  if (!draft.value) return
  // Keep breakpoints ordered by upToKg ascending.
  const sorted = [...draft.value.loadingCharge.breakpoints].sort((a, b) => a.upToKg - b.upToKg)
  draft.value.loadingCharge.breakpoints = sorted
  const payload = JSON.parse(JSON.stringify(draft.value)) as AppSettings
  updateSettings.mutate(payload, {
    onSuccess: () => {
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    }
  })
}
</script>

<template>
  <div
    v-if="draft"
    class="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-8"
    data-testid="settings-page"
  >
    <div class="flex items-center gap-3">
      <SettingsIcon class="size-6" />
      <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
    </div>

    <section class="space-y-2">
      <h2 class="font-semibold">Shop</h2>
      <div class="grid gap-2">
        <Label for="company-name">Company Name</Label>
        <Input
          id="company-name"
          :model-value="draft.companyName"
          placeholder="Shop name"
          data-testid="company-name-input"
          @update:model-value="draft.companyName = String($event)"
        />
        <p class="text-sm text-muted-foreground">
          Heads every Quotation and appears on the Credit Voucher the customer signs.
        </p>
      </div>
      <div class="grid gap-2">
        <Label for="upi-id">UPI ID</Label>
        <Input
          id="upi-id"
          :model-value="draft.upiId"
          placeholder="e.g. shopname@ybl"
          data-testid="upi-id-input"
          @update:model-value="draft.upiId = String($event).trim()"
        />
        <p class="text-sm text-muted-foreground">
          Printed as a QR on the Credit Voucher (no amount — the customer enters it when paying).
          Leave blank for no QR.
        </p>
      </div>
      <div class="grid gap-2">
        <Label for="voucher-interest">Voucher interest (₹ per ₹100 per month)</Label>
        <NumericField
          id="voucher-interest"
          mode="money"
          class="w-32"
          :model-value="draft.voucherInterestPaisePer100"
          :allow-empty="false"
          test-id="voucher-interest-input"
          @update:model-value="draft.voucherInterestPaisePer100 = Math.max(0, $event ?? 0)"
        />
        <p class="text-sm text-muted-foreground">
          Printed in the Credit Voucher's interest clause.
        </p>
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="font-semibold">Printing</h2>
      <p class="text-sm text-muted-foreground">
        Finishing a Sale saves its papers as PDFs in Documents/VajraPrints.
      </p>
      <label class="flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm">
        <Checkbox
          :model-value="draft.printerless"
          data-testid="printerless-toggle"
          @update:model-value="draft.printerless = $event === true"
        />
        <span>
          <span class="font-medium">Printerless Mode</span>
          <span class="block text-muted-foreground">
            Show the papers on screen to copy by hand instead of saving PDFs.
          </span>
        </span>
      </label>
      <div class="space-y-2 rounded-md border p-3 text-sm">
        <p class="font-medium">Credit Sale — Quotation default</p>
        <p class="text-muted-foreground">
          The Credit Voucher always prints. The cashier can still change these on the finish screen.
        </p>
        <label class="flex cursor-pointer items-center gap-3">
          <Checkbox
            :model-value="draft.creditPrintQuotation"
            data-testid="credit-print-quotation-default"
            @update:model-value="
              (v) => {
                draft!.creditPrintQuotation = v === true
                if (v !== true) draft!.creditQuotationTwoCopies = false
              }
            "
          />
          <span>Print Quotation</span>
        </label>
        <label
          class="flex items-center gap-3"
          :class="draft.creditPrintQuotation ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'"
        >
          <Checkbox
            :model-value="draft.creditQuotationTwoCopies"
            :disabled="!draft.creditPrintQuotation"
            data-testid="credit-two-copies-default"
            @update:model-value="draft.creditQuotationTwoCopies = $event === true"
          />
          <span>Two copies (business + customer)</span>
        </label>
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="font-semibold">Drafts</h2>
      <div class="grid gap-2">
        <Label for="draft-cap">Maximum Drafts (Sale + Purchase)</Label>
        <NumericField
          id="draft-cap"
          mode="integer"
          class="w-32"
          :model-value="draft.draftCap"
          :allow-empty="false"
          test-id="draft-cap-input"
          @update:model-value="draft.draftCap = Math.max(1, $event ?? 1)"
        />
        <p class="text-sm text-muted-foreground">
          Global cap for parked carts on the open Business Day. Default is 5.
        </p>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-semibold">Bag Types</h2>
      <p class="text-sm text-muted-foreground">
        Standard pack weights used on cart bag lines for pricing by Quintal Rate.
      </p>
      <div class="space-y-2">
        <div
          v-for="sizeG in draft.bagTypes"
          :key="sizeG"
          class="flex items-center gap-3 rounded-md border p-2"
          data-testid="bag-type-row"
          :data-bag-size="gToKg(sizeG)"
        >
          <span class="w-20 font-medium tabular-nums">{{ formatBagKg(sizeG) }}</span>
          <Button
            variant="ghost"
            size="icon"
            :data-testid="`bag-type-remove-${gToKg(sizeG)}`"
            @click="removeBagType(sizeG)"
          >
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <NumericField
          mode="decimal"
          class="w-32"
          :model-value="newBagSizeKg"
          placeholder="New kg"
          test-id="new-bag-size"
          @update:model-value="newBagSizeKg = $event"
        />
        <Button variant="outline" size="sm" data-testid="add-bag-type" @click="addBagType">
          <Plus class="mr-2 size-4" /> Add Bag Type
        </Button>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-semibold">Loading Charges</h2>
      <p class="text-sm text-muted-foreground">
        Charge per bag (by bag weight) or per Loose line (by total kg). Opt-in on Sales only.
        Breakpoints are inclusive upper bounds: weight ≤ N kg pays the listed charge.
      </p>
      <div class="space-y-2">
        <div
          v-for="(_bp, index) in draft.loadingCharge.breakpoints"
          :key="index"
          class="flex flex-wrap items-center gap-3 rounded-md border p-2"
          data-testid="loading-breakpoint-row"
        >
          <Label class="text-xs text-muted-foreground">Up to (kg)</Label>
          <NumericField
            mode="decimal"
            class="w-24"
            :model-value="bpUpToKg(index)"
            :test-id="`loading-bp-kg-${index}`"
            @update:model-value="setBpUpToKg(index, $event)"
          />
          <Label class="text-xs text-muted-foreground">₹ / parcel</Label>
          <NumericField
            mode="money"
            class="w-28"
            :model-value="bpChargePaise(index)"
            :test-id="`loading-bp-rate-${index}`"
            @update:model-value="setBpChargePaise(index, $event)"
          />
          <Button
            variant="ghost"
            size="icon"
            :data-testid="`loading-bp-remove-${index}`"
            @click="removeBreakpoint(index)"
          >
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
        <div
          class="flex flex-wrap items-center gap-3 rounded-md border p-2"
          data-testid="loading-above-row"
        >
          <span class="text-sm font-medium">Above last breakpoint</span>
          <Label class="text-xs text-muted-foreground">₹ / parcel</Label>
          <NumericField
            mode="money"
            class="w-28"
            :model-value="aboveLastPaise()"
            test-id="loading-above-rate"
            @update:model-value="setAboveLastPaise($event)"
          />
        </div>
      </div>
      <Button variant="outline" size="sm" data-testid="loading-bp-add" @click="addBreakpoint">
        <Plus class="mr-2 size-4" /> Add Breakpoint
      </Button>

      <div class="mt-4 space-y-2 rounded-md border bg-muted/20 p-3" data-testid="loading-test">
        <h3 class="text-sm font-medium">Test charge</h3>
        <p class="text-xs text-muted-foreground">
          Enter a weight in kg to see the charge the breakpoints above would produce (uses the form
          values, even if not saved).
        </p>
        <div class="flex flex-wrap items-center gap-3">
          <NumericField
            mode="decimal"
            class="w-32"
            :model-value="testWeightKg"
            placeholder="Weight kg"
            test-id="loading-test-kg"
            @update:model-value="testWeightKg = $event"
          />
          <span class="text-sm tabular-nums" data-testid="loading-test-result">
            <template v-if="testChargePaise != null">
              Charge: {{ formatRupees(testChargePaise) }}
            </template>
            <template v-else>—</template>
          </span>
        </div>
      </div>
    </section>

    <div class="flex items-center gap-3 border-t pt-4">
      <Button data-testid="settings-save" @click="save">Save Settings</Button>
      <span v-if="saved" class="text-sm text-green-600" data-testid="settings-saved">Saved</span>
    </div>
  </div>
</template>
