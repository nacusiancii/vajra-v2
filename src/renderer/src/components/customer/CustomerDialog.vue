<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import ComboboxField from '@/components/ComboboxField.vue'
import { isNameTaken, checkDuplicateWarning } from '@domain/customer'
import type { Customer, CreateCustomerInput, UpdateCustomerInput } from '@domain/types'
import { useCustomersQuery, usePlacesQuery } from '@/queries/customers'

const props = defineProps<{
  open: boolean
  customer: Customer | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [input: CreateCustomerInput]
  update: [id: number, input: UpdateCustomerInput]
}>()

const isEditing = computed(() => props.customer !== null)
const { data: customers } = useCustomersQuery()
const { data: places } = usePlacesQuery()

const placeNames = computed(() => (places.value ?? []).map((p) => p.name))

const schema = toTypedSchema(
  z.object({
    name: z.string().trim().min(1, 'Name is required'),
    placeName: z.string().trim().min(1, 'Place is required'),
    phone: z.string().trim().optional().default(''),
    nameTe: z.string().trim().optional().default(''),
    placeTe: z.string().trim().optional().default(''),
    remarks: z.string().trim().optional().default('')
  })
)

const { handleSubmit, resetForm, setFieldValue, values, errors } = useForm({
  validationSchema: schema
})

watch(
  () => props.open,
  (open) => {
    if (open) {
      const c = props.customer
      resetForm({
        values: {
          name: c?.name ?? '',
          placeName: c?.placeName ?? '',
          phone: c?.phone ?? '',
          nameTe: c?.nameTe ?? '',
          placeTe: c?.placeTe ?? '',
          remarks: c?.remarks ?? ''
        }
      })
    }
  }
)

const nameConflict = computed(() => {
  const name = values.name?.trim()
  if (!name) return false
  return isNameTaken(name, customers.value ?? [], props.customer?.id)
})

const duplicateWarning = computed(() => {
  const place = values.placeName?.trim()
  const phone = values.phone?.trim()
  if (!place || !phone) return null
  return checkDuplicateWarning(place, phone || null, customers.value ?? [], props.customer?.id)
})

const onSubmit = handleSubmit((formValues) => {
  if (nameConflict.value) return
  const input = {
    name: formValues.name,
    placeName: formValues.placeName,
    phone: formValues.phone || null,
    nameTe: formValues.nameTe || null,
    placeTe: formValues.placeTe || null,
    remarks: formValues.remarks || null
  }
  if (isEditing.value && props.customer) {
    emit('update', props.customer.id, input)
  } else {
    emit('create', input)
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg" data-testid="customer-dialog">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? 'Edit Customer' : 'Add Customer' }}</DialogTitle>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="onSubmit">
        <!-- Name -->
        <div class="grid gap-2">
          <Label for="customer-name">Name *</Label>
          <Input
            id="customer-name"
            :model-value="values.name"
            @update:model-value="setFieldValue('name', $event as string)"
            placeholder="English name"
            data-testid="customer-name-input"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          <p v-if="nameConflict" class="text-sm text-destructive">
            A customer with this name already exists
          </p>
        </div>

        <!-- Place -->
        <div class="grid gap-2">
          <Label>Place *</Label>
          <ComboboxField
            :model-value="values.placeName ?? ''"
            @update:model-value="setFieldValue('placeName', $event)"
            :options="placeNames"
            placeholder="Select or type a place..."
            test-id="customer-place-combobox"
          />
          <p v-if="errors.placeName" class="text-sm text-destructive">{{ errors.placeName }}</p>
        </div>

        <!-- Phone -->
        <div class="grid gap-2">
          <Label for="customer-phone">Phone</Label>
          <Input
            id="customer-phone"
            :model-value="values.phone"
            @update:model-value="setFieldValue('phone', $event as string)"
            placeholder="Phone number"
            data-testid="customer-phone-input"
          />
        </div>

        <!-- Duplicate warning -->
        <div
          v-if="duplicateWarning"
          class="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200"
          data-testid="duplicate-warning"
        >
          <strong>Similar customer found:</strong> {{ duplicateWarning.reason }}
        </div>

        <!-- Telugu Name -->
        <div class="grid gap-2">
          <Label for="customer-name-te">
            Telugu Name
            <Badge v-if="!values.nameTe" variant="outline" class="ml-2 text-xs">missing</Badge>
          </Label>
          <Input
            id="customer-name-te"
            :model-value="values.nameTe"
            @update:model-value="setFieldValue('nameTe', $event as string)"
            placeholder="తెలుగు పేరు"
            data-testid="customer-name-te-input"
          />
        </div>

        <!-- Telugu Place -->
        <div class="grid gap-2">
          <Label for="customer-place-te">
            Telugu Place
            <Badge v-if="!values.placeTe" variant="outline" class="ml-2 text-xs">missing</Badge>
          </Label>
          <Input
            id="customer-place-te"
            :model-value="values.placeTe"
            @update:model-value="setFieldValue('placeTe', $event as string)"
            placeholder="తెలుగు ప్రదేశం"
            data-testid="customer-place-te-input"
          />
        </div>

        <!-- Remarks -->
        <div class="grid gap-2">
          <Label for="customer-remarks">Remarks</Label>
          <Input
            id="customer-remarks"
            :model-value="values.remarks"
            @update:model-value="setFieldValue('remarks', $event as string)"
            placeholder="Optional notes"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="$emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="nameConflict" data-testid="customer-submit">
            {{ isEditing ? 'Save Changes' : 'Add Customer' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
