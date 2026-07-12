<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Settings as SettingsIcon, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useSettingsQuery, useUpdateSettings } from '@/queries/operations'
import { useProductsQuery } from '@/queries/products'
import {
  addDefaultBagType,
  isPositiveIntegerKg,
  removeDefaultBagType,
  setDefaultBagTypeLoading,
  type AppSettings
} from '@domain/settings'

const { data: settings } = useSettingsQuery()
const { data: products } = useProductsQuery()
const updateSettings = useUpdateSettings()

const draft = ref<AppSettings | null>(null)
const newBagSize = ref<string>('')
const newLoading = ref<string>('0')
const bagTypeError = ref<string | null>(null)
const saved = ref(false)

watch(
  settings,
  (s) => {
    if (s && !draft.value) draft.value = JSON.parse(JSON.stringify(s)) as AppSettings
  },
  { immediate: true }
)

/** How many Products use each Default Bag Size (for remove guardrails in the UI). */
const productCountBySize = computed(() => {
  const map = new Map<number, number>()
  for (const p of products.value ?? []) {
    if (p.type === 'bulk' && p.defaultBagSizeKg != null) {
      map.set(p.defaultBagSizeKg, (map.get(p.defaultBagSizeKg) ?? 0) + 1)
    }
  }
  return map
})

function loadingRate(size: number): number {
  return draft.value?.loadingChargePerBag[size] ?? 0
}

function setLoadingRate(size: number, value: number): void {
  if (!draft.value) return
  const result = setDefaultBagTypeLoading(draft.value, size, value)
  if ('error' in result) {
    bagTypeError.value = result.error
    return
  }
  bagTypeError.value = null
  draft.value = result.settings
}

function addBagType(): void {
  if (!draft.value) return
  const raw = newBagSize.value.trim()
  const size = Number(raw)
  if (raw === '' || !Number.isFinite(size) || !isPositiveIntegerKg(size)) {
    bagTypeError.value = 'Default Bag Type kg must be a positive integer'
    return
  }
  const loading = Number(newLoading.value)
  const rate = Number.isFinite(loading) ? loading : 0
  const result = addDefaultBagType(draft.value, size, rate)
  if ('error' in result) {
    bagTypeError.value = result.error
    return
  }
  bagTypeError.value = null
  draft.value = result.settings
  newBagSize.value = ''
  newLoading.value = '0'
}

function removeBagType(size: number): void {
  if (!draft.value) return
  const inUse = productCountBySize.value.get(size) ?? 0
  const result = removeDefaultBagType(draft.value, size, inUse)
  if ('error' in result) {
    bagTypeError.value = result.error
    return
  }
  bagTypeError.value = null
  draft.value = result.settings
}

function save(): void {
  if (!draft.value) return
  // Clone to a plain object — Vue reactive proxies are not structured-cloneable
  // and ipcRenderer.invoke would fail silently from the mutation's perspective.
  const payload = JSON.parse(JSON.stringify(draft.value)) as AppSettings
  // Toggle is disabled; keep payload aligned with the forced server-side lock (#22).
  payload.printerlessMode = true
  bagTypeError.value = null
  updateSettings.mutate(payload, {
    onSuccess: (savedSettings) => {
      draft.value = JSON.parse(JSON.stringify(savedSettings)) as AppSettings
      saved.value = true
      setTimeout(() => (saved.value = false), 2000)
    },
    onError: (err) => {
      bagTypeError.value = err instanceof Error ? err.message : 'Failed to save settings'
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

    <!-- Printerless Mode: locked until #28 (thermal print) -->
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

    <!-- Draft capacity (ADR-0010) -->
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

    <!-- Default Bag Types + Loading Charges -->
    <section class="space-y-3">
      <h2 class="font-semibold">Default Bag Types &amp; Loading Charges</h2>
      <p class="text-sm text-muted-foreground">
        Shop-managed catalog of standard pack weights. Used as Product Default Bag Size and as
        one-tap bag choices on Sale and Purchase. Loading Charge is ₹ per bag when opted in on a
        Sale. kg cannot be changed after add — only the loading rate is editable.
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
            :title="
              (productCountBySize.get(size) ?? 0) > 0
                ? 'In use as a Product Default Bag Size'
                : draft.bagTypes.length <= 1
                  ? 'Cannot remove the last Default Bag Type'
                  : 'Remove Default Bag Type'
            "
            @click="removeBagType(size)"
          >
            <Trash2 class="size-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <div class="grid gap-1">
          <Label class="text-xs text-muted-foreground" for="new-bag-size">kg</Label>
          <Input
            id="new-bag-size"
            type="number"
            min="1"
            step="1"
            class="w-28"
            :model-value="newBagSize"
            placeholder="e.g. 40"
            data-testid="new-bag-size"
            @update:model-value="newBagSize = String($event)"
          />
        </div>
        <div class="grid gap-1">
          <Label class="text-xs text-muted-foreground" for="new-bag-loading">₹/bag</Label>
          <Input
            id="new-bag-loading"
            type="number"
            min="0"
            class="w-28"
            :model-value="newLoading"
            data-testid="new-bag-loading"
            @update:model-value="newLoading = String($event)"
          />
        </div>
        <Button variant="outline" size="sm" data-testid="add-bag-type" @click="addBagType">
          <Plus class="mr-2 size-4" /> Add Default Bag Type
        </Button>
      </div>
      <p
        v-if="bagTypeError"
        class="text-sm text-destructive"
        data-testid="bag-type-error"
        role="alert"
      >
        {{ bagTypeError }}
      </p>
    </section>

    <div class="flex items-center gap-3 border-t pt-4">
      <Button data-testid="settings-save" @click="save">Save Settings</Button>
      <span v-if="saved" class="text-sm text-green-600" data-testid="settings-saved">Saved</span>
    </div>
  </div>
</template>
