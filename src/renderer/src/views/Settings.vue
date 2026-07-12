<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Settings as SettingsIcon, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSettingsQuery, useUpdateSettings } from '@/queries/operations'
import type { AppSettings, LoadingChargeBreakpoint } from '@domain/settings'
import { computeLoadingCharge } from '@domain/transaction-rules'
import { gToKg, kgToG, paiseToRupees, rupeesToPaise } from '@domain/units'
import { formatKgFromG, formatRupees } from '@/lib/format'

const { data: settings } = useSettingsQuery()
const updateSettings = useUpdateSettings()

const draft = ref<AppSettings | null>(null)
const saved = ref(false)

/** Test weight (kg) for the Loading Charge calculator. */
const testWeightKg = ref<number | null>(null)
const testResultPaise = ref<number | null>(null)

watch(
  settings,
  (s) => {
    if (s && !draft.value) draft.value = JSON.parse(JSON.stringify(s)) as AppSettings
  },
  { immediate: true }
)

function breakpointMaxKg(bp: LoadingChargeBreakpoint): number | null {
  return bp.maxMassG == null ? null : gToKg(bp.maxMassG)
}

function setBreakpointMaxKg(index: number, kg: number | null): void {
  if (!draft.value) return
  const next = [...draft.value.loadingChargeBreakpoints]
  const row = { ...next[index]! }
  row.maxMassG = kg == null || !Number.isFinite(kg) || kg <= 0 ? null : kgToG(kg)
  next[index] = row
  draft.value.loadingChargeBreakpoints = next
}

function breakpointChargeRupees(bp: LoadingChargeBreakpoint): number {
  return paiseToRupees(bp.chargePaise)
}

function setBreakpointChargeRupees(index: number, rupees: number): void {
  if (!draft.value) return
  const next = [...draft.value.loadingChargeBreakpoints]
  next[index] = { ...next[index]!, chargePaise: rupeesToPaise(rupees) }
  draft.value.loadingChargeBreakpoints = next
}

function addBreakpoint(): void {
  if (!draft.value) return
  // Insert before the catch-all (null max) if present; otherwise append.
  const list = [...draft.value.loadingChargeBreakpoints]
  const catchAllIdx = list.findIndex((b) => b.maxMassG == null)
  const row: LoadingChargeBreakpoint = { maxMassG: 20_000, chargePaise: 0 }
  if (catchAllIdx >= 0) list.splice(catchAllIdx, 0, row)
  else list.push(row)
  draft.value.loadingChargeBreakpoints = list
}

function removeBreakpoint(index: number): void {
  if (!draft.value) return
  if (draft.value.loadingChargeBreakpoints.length <= 1) return
  draft.value.loadingChargeBreakpoints = draft.value.loadingChargeBreakpoints.filter(
    (_, i) => i !== index
  )
}

function runLoadingTest(): void {
  if (!draft.value || testWeightKg.value == null || !(testWeightKg.value > 0)) {
    testResultPaise.value = null
    return
  }
  testResultPaise.value = computeLoadingCharge(
    kgToG(testWeightKg.value),
    draft.value.loadingChargeBreakpoints
  )
}

function save(): void {
  if (!draft.value) return
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
      <h2 class="font-semibold">Loading Charge (by weight)</h2>
      <p class="text-sm text-muted-foreground">
        Flat charge from total bulk mass on a Sale when Loading is opted in. First matching tier
        wins (≤ max kg). Leave max empty for the catch-all tier.
      </p>
      <div class="space-y-2">
        <div
          v-for="(bp, index) in draft.loadingChargeBreakpoints"
          :key="index"
          class="flex flex-wrap items-center gap-3 rounded-md border p-2"
          data-testid="loading-breakpoint-row"
        >
          <div class="flex items-center gap-2">
            <Label class="text-xs text-muted-foreground whitespace-nowrap">≤ kg</Label>
            <Input
              type="number"
              min="0"
              class="w-24"
              :model-value="breakpointMaxKg(bp) ?? ''"
              placeholder="rest"
              :data-testid="`loading-bp-max-${index}`"
              @update:model-value="setBreakpointMaxKg(index, $event === '' ? null : Number($event))"
            />
          </div>
          <div class="flex items-center gap-2">
            <Label class="text-xs text-muted-foreground">₹</Label>
            <Input
              type="number"
              min="0"
              class="w-28"
              :model-value="breakpointChargeRupees(bp)"
              :data-testid="`loading-bp-charge-${index}`"
              @update:model-value="setBreakpointChargeRupees(index, Number($event) || 0)"
            />
          </div>
          <span class="text-xs text-muted-foreground tabular-nums">
            <template v-if="bp.maxMassG != null">≤ {{ formatKgFromG(bp.maxMassG) }}</template>
            <template v-else>above previous</template>
          </span>
          <Button
            variant="ghost"
            size="icon"
            :data-testid="`loading-bp-remove-${index}`"
            :disabled="draft.loadingChargeBreakpoints.length <= 1"
            @click="removeBreakpoint(index)"
          >
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
      </div>
      <Button variant="outline" size="sm" data-testid="loading-bp-add" @click="addBreakpoint">
        <Plus class="mr-2 size-4" /> Add breakpoint
      </Button>

      <div
        class="mt-4 space-y-2 rounded-md border bg-muted/20 p-3"
        data-testid="loading-test-panel"
      >
        <Label class="font-medium">Test Loading Charge</Label>
        <p class="text-xs text-muted-foreground">
          Enter a bulk weight to see which tier applies (uses the draft values above, even if not
          saved).
        </p>
        <div class="flex flex-wrap items-end gap-2">
          <div class="grid gap-1">
            <Label class="text-xs text-muted-foreground">Weight (kg)</Label>
            <Input
              type="number"
              min="0"
              step="0.1"
              class="w-32"
              :model-value="testWeightKg ?? ''"
              data-testid="loading-test-weight"
              @update:model-value="testWeightKg = $event === '' ? null : Number($event)"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            data-testid="loading-test-run"
            @click="runLoadingTest"
          >
            Test
          </Button>
          <p
            v-if="testResultPaise != null"
            class="text-sm font-medium tabular-nums"
            data-testid="loading-test-result"
          >
            Charge: {{ formatRupees(testResultPaise) }}
          </p>
        </div>
      </div>
    </section>

    <div class="flex items-center gap-3 border-t pt-4">
      <Button data-testid="settings-save" @click="save">Save Settings</Button>
      <span v-if="saved" class="text-sm text-green-600" data-testid="settings-saved">Saved</span>
    </div>
  </div>
</template>
