<script setup lang="ts">
import { computed, ref } from 'vue'
import { Pencil, UserPlus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import EntityCombobox, { type ComboboxOption } from '@/components/EntityCombobox.vue'
import CustomerDialog from '@/components/customer/CustomerDialog.vue'
import { useCustomersQuery, useCreateCustomer, useUpdateCustomer } from '@/queries/customers'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@domain/types'

const props = withDefaults(
  defineProps<{
    /** Open the picker on mount so the cashier starts in the search box. */
    autoFocus?: boolean
    testId?: string
    /** Label above the combobox. Pass empty string to omit (parent supplies its own). */
    label?: string
  }>(),
  {
    label: 'Select customer'
  }
)

const model = defineModel<number | null>({ required: true })

const { data: customers } = useCustomersQuery()
const createCustomer = useCreateCustomer()
const updateCustomer = useUpdateCustomer()

const customerList = computed(() => customers.value ?? [])
const options = computed<ComboboxOption[]>(() =>
  customerList.value.map((c) => ({ value: c.id, label: c.name, hint: c.placeName }))
)
const selectedCustomer = computed(
  () => customerList.value.find((c) => c.id === model.value) ?? null
)

const selectTestId = computed(() => props.testId ?? 'customer-select')
const placeDisplay = computed(() => selectedCustomer.value?.placeName ?? '')
const mobileDisplay = computed(() => {
  const phone = selectedCustomer.value?.phone?.trim()
  return phone || '—'
})

const dialogOpen = ref(false)
const editing = ref<Customer | null>(null)

function openAdd(): void {
  editing.value = null
  dialogOpen.value = true
}

function openEdit(): void {
  if (!selectedCustomer.value) return
  editing.value = selectedCustomer.value
  dialogOpen.value = true
}

function onCreate(input: CreateCustomerInput): void {
  createCustomer.mutate(input, {
    onSuccess: (created) => {
      model.value = created.id
      dialogOpen.value = false
    }
  })
}

function onUpdate(id: number, input: UpdateCustomerInput): void {
  updateCustomer.mutate({ id, input }, { onSuccess: () => (dialogOpen.value = false) })
}
</script>

<template>
  <div class="flex flex-wrap items-end gap-4">
    <div class="grid gap-2">
      <Label v-if="label">{{ label }}</Label>
      <div class="flex items-center gap-2">
        <div class="min-w-[240px] flex-1">
          <EntityCombobox
            v-model="model"
            :options="options"
            :auto-focus="autoFocus"
            placeholder="Choose a customer"
            search-placeholder="Type a customer name…"
            empty-text="No customer matches."
            :test-id="selectTestId"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title="Add Customer"
          data-testid="customer-add"
          @click="openAdd"
        >
          <UserPlus class="size-4" />
        </Button>
        <Button
          v-if="selectedCustomer"
          type="button"
          variant="outline"
          size="icon"
          title="Edit Customer"
          data-testid="customer-edit"
          @click="openEdit"
        >
          <Pencil class="size-4" />
        </Button>
      </div>
    </div>

    <template v-if="selectedCustomer">
      <div class="grid gap-2">
        <Label>Place</Label>
        <Input
          :model-value="placeDisplay"
          readonly
          tabindex="-1"
          class="bg-muted/50"
          :data-testid="`${selectTestId}-place`"
        />
      </div>
      <div class="grid gap-2">
        <Label>Mobile</Label>
        <Input
          :model-value="mobileDisplay"
          readonly
          tabindex="-1"
          class="bg-muted/50 tabular-nums"
          :data-testid="`${selectTestId}-mobile`"
        />
      </div>
    </template>

    <CustomerDialog
      :open="dialogOpen"
      :customer="editing"
      @update:open="dialogOpen = $event"
      @create="onCreate"
      @update="onUpdate"
    />
  </div>
</template>
