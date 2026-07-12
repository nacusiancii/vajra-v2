<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Settings as SettingsIcon, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSettingsQuery, useUpdateSettings } from '@/queries/operations'
import { loadingChargeForKg, type AppSettings, type LoadingChargeRules } from '@domain/settings'
import { gToKg, kgToG, paiseToRupees, rupeesToPaise, type BagSizeG } from '@domain/units'
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

function bpUpToKg(index: number): number {
  return draft.value?.loadingCharge.breakpoints[index]?.upToKg ?? 0
}

function setBpUpToKg(index: number, kg: number): void {
  if (!draft.value) return
  const bp = draft.value.loadingCharge.breakpoints[index]
  if (bp) bp.upToKg = kg
}

function bpChargeRupees(index: number): number {
  return paiseToRupees(draft.value?.loadingCharge.breakpoints[index]?.chargePaise ?? 0)
}

function setBpChargeRupees(index: number, rupees: number): void {
  if (!draft.value) return
  const bp = draft.value.loadingCharge.breakpoints[index]
  if (bp) bp.chargePaise = rupeesToPaise(rupees)
}

function aboveLastRupees(): number {
  return paiseToRupees(draft.value?.loadingCharge.aboveLastPaise ?? 0)
}

function setAboveLastRupees(rupees: number): void {
  if (draft.value) draft.value.loadingCharge.aboveLastPaise = rupeesToPaise(rupees)
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
  payload.printerlessMode = true
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
          placeholder="Printed on the Credit Voucher"
          data-testid="company-name-input"
          @update:model-value="draft.companyName = String($event)"
        />
        <p class="text-sm text-muted-foreground">
          Appears on the front of every Credit Voucher the customer signs.
        </p>
      </div>
    </section>

    <section class="space-y-2">
      <h2 class="font-semibold">Printing</h2>
      <label
        class="flex cursor-not-allowed items-center gap-3 rounded-md border p-3 text-sm opacity-80"
      >
        <Checkbox :model-value="true" disabled data-testid="printerless-toggle" />
        <span>
          <span class="font-medium">Printerless Mode</span>
          <span class="block text-muted-foreground">
            Always on — no printer mode is available yet. Slips show on screen for hand-copying.
          </span>
        </span>
      </label>
    </section>

    <section class="space-y-2">
      <h2 class="font-semibold">Drafts</h2>
      <div class="grid gap-2">
        <Label for="draft-cap">Maximum Drafts (Sale + Purchase)</Label>
        <Input
          id="draft-cap"
          type="number"
          min="1"
          class="w-32"
          :model-value="draft.draftCap"
          data-testid="draft-cap-input"
          @update:model-value="draft.draftCap = Math.max(1, Math.floor(Number($event) || 1))"
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
        <Input
          type="number"
          min="0"
          class="w-32"
          :model-value="newBagSizeKg ?? ''"
          placeholder="New kg"
          data-testid="new-bag-size"
          @update:model-value="newBagSizeKg = $event === '' ? null : Number($event)"
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
          <Input
            type="number"
            min="0"
            step="0.1"
            class="w-24"
            :model-value="bpUpToKg(index)"
            :data-testid="`loading-bp-kg-${index}`"
            @update:model-value="setBpUpToKg(index, Number($event) || 0)"
          />
          <Label class="text-xs text-muted-foreground">₹ / parcel</Label>
          <Input
            type="number"
            min="0"
            class="w-28"
            :model-value="bpChargeRupees(index)"
            :data-testid="`loading-bp-rate-${index}`"
            @update:model-value="setBpChargeRupees(index, Number($event) || 0)"
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
          <Input
            type="number"
            min="0"
            class="w-28"
            :model-value="aboveLastRupees()"
            data-testid="loading-above-rate"
            @update:model-value="setAboveLastRupees(Number($event) || 0)"
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
          <Input
            type="number"
            min="0"
            step="0.1"
            class="w-32"
            :model-value="testWeightKg ?? ''"
            placeholder="Weight kg"
            data-testid="loading-test-kg"
            @update:model-value="testWeightKg = $event === '' ? null : Number($event)"
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
