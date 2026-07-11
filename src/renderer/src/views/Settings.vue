<script setup lang="ts">
import { ref, watch } from 'vue'
import { Plus, Settings as SettingsIcon, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSettingsQuery, useUpdateSettings } from '@/queries/operations'
import type { AppSettings } from '@domain/settings'
import type { BagSizeKg } from '@domain/types'

const { data: settings } = useSettingsQuery()
const updateSettings = useUpdateSettings()

const draft = ref<AppSettings | null>(null)
const newBagSize = ref<number | null>(null)
const saved = ref(false)

watch(
  settings,
  (s) => {
    if (s && !draft.value) draft.value = JSON.parse(JSON.stringify(s)) as AppSettings
  },
  { immediate: true }
)

function loadingRate(size: number): number {
  return draft.value?.loadingChargePerBag[size] ?? 0
}
function setLoadingRate(size: number, value: number): void {
  if (draft.value) draft.value.loadingChargePerBag[size] = value
}

function addBagType(): void {
  const size = newBagSize.value
  if (!draft.value || !size || size <= 0) return
  if (!draft.value.bagTypes.includes(size as BagSizeKg)) {
    draft.value.bagTypes = [...draft.value.bagTypes, size as BagSizeKg].sort((a, b) => a - b)
    draft.value.loadingChargePerBag[size] = draft.value.loadingChargePerBag[size] ?? 0
  }
  newBagSize.value = null
}

function removeBagType(size: number): void {
  if (draft.value) draft.value.bagTypes = draft.value.bagTypes.filter((b) => b !== size)
}

function save(): void {
  if (!draft.value) return
  // Clone to a plain object — Vue reactive proxies are not structured-cloneable
  // and ipcRenderer.invoke would fail silently from the mutation's perspective.
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

    <!-- Shop identity -->
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

    <!-- Printerless Mode -->
    <section class="space-y-2">
      <h2 class="font-semibold">Printing</h2>
      <label class="flex items-center gap-3 rounded-md border p-3 text-sm">
        <Checkbox
          :model-value="draft.printerlessMode"
          data-testid="printerless-toggle"
          @update:model-value="draft.printerlessMode = $event === true"
        />
        <span>
          <span class="font-medium">Printerless Mode</span>
          <span class="block text-muted-foreground">
            Show the would-be slip on screen instead of printing, so the cashier can copy it by
            hand.
          </span>
        </span>
      </label>
    </section>

    <!-- Bag Types + Loading Charges -->
    <section class="space-y-3">
      <h2 class="font-semibold">Bag Types &amp; Loading Charges</h2>
      <p class="text-sm text-muted-foreground">
        Loading Charge is a rupee rate per bag, applied per Bag Type when opted in on a Sale.
      </p>
      <div class="space-y-2">
        <div
          v-for="size in draft.bagTypes"
          :key="size"
          class="flex items-center gap-3 rounded-md border p-2"
          data-testid="bag-type-row"
          :data-bag-size="size"
        >
          <span class="w-20 font-medium tabular-nums">{{ size }} kg</span>
          <div class="flex flex-1 items-center gap-2">
            <Label class="text-xs text-muted-foreground">₹/bag</Label>
            <Input
              type="number"
              min="0"
              class="w-28"
              :model-value="loadingRate(size)"
              :data-testid="`bag-type-rate-${size}`"
              @update:model-value="setLoadingRate(size, Number($event) || 0)"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            :data-testid="`bag-type-remove-${size}`"
            @click="removeBagType(size)"
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
          :model-value="newBagSize ?? ''"
          placeholder="New kg"
          data-testid="new-bag-size"
          @update:model-value="newBagSize = $event === '' ? null : Number($event)"
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
