<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Settings as SettingsIcon, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSettingsQuery, useUpdateSettings } from '@/queries/operations'
import type { AppSettings } from '@domain/settings'
import { gToKg, kgToG, paiseToRupees, rupeesToPaise, type BagSizeG } from '@domain/units'
import { formatBagKg } from '@/lib/format'

const { data: settings } = useSettingsQuery()
const updateSettings = useUpdateSettings()

const draft = ref<AppSettings | null>(null)
/** New bag size typed in kg (cashier unit). */
const newBagSizeKg = ref<number | null>(null)
const saved = ref(false)

watch(
  settings,
  (s) => {
    if (s && !draft.value) draft.value = JSON.parse(JSON.stringify(s)) as AppSettings
  },
  { immediate: true }
)

function loadingRateRupees(sizeG: number): number {
  return paiseToRupees(draft.value?.loadingChargePerBag[sizeG] ?? 0)
}
function setLoadingRateRupees(sizeG: number, rupees: number): void {
  if (draft.value) draft.value.loadingChargePerBag[sizeG] = rupeesToPaise(rupees)
}

function addBagType(): void {
  const kg = newBagSizeKg.value
  if (!draft.value || !kg || kg <= 0) return
  const sizeG = kgToG(kg) as BagSizeG
  if (!draft.value.bagTypes.includes(sizeG)) {
    draft.value.bagTypes = [...draft.value.bagTypes, sizeG].sort((a, b) => a - b)
    draft.value.loadingChargePerBag[sizeG] = draft.value.loadingChargePerBag[sizeG] ?? 0
  }
  newBagSizeKg.value = null
}

function removeBagType(sizeG: number): void {
  if (draft.value) draft.value.bagTypes = draft.value.bagTypes.filter((b) => b !== sizeG)
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
      <h2 class="font-semibold">Bag Types &amp; Loading Charges</h2>
      <p class="text-sm text-muted-foreground">
        Loading Charge is a rupee rate per bag, applied per Bag Type when opted in on a Sale.
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
          <div class="flex flex-1 items-center gap-2">
            <Label class="text-xs text-muted-foreground">₹/bag</Label>
            <Input
              type="number"
              min="0"
              class="w-28"
              :model-value="loadingRateRupees(sizeG)"
              :data-testid="`bag-type-rate-${gToKg(sizeG)}`"
              @update:model-value="setLoadingRateRupees(sizeG, Number($event) || 0)"
            />
          </div>
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

    <div class="flex items-center gap-3 border-t pt-4">
      <Button data-testid="settings-save" @click="save">Save Settings</Button>
      <span v-if="saved" class="text-sm text-green-600" data-testid="settings-saved">Saved</span>
    </div>
  </div>
</template>
