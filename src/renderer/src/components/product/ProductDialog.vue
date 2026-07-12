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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import ComboboxField from '@/components/ComboboxField.vue'
import { isNameTaken } from '@domain/product'
import {
  SEED_BAG_SIZES,
  type CreateProductInput,
  type UpdateProductInput,
  type Product
} from '@domain/types'
import { useProductsQuery, useProductGroupsQuery } from '@/queries/products'
import { useSettingsQuery } from '@/queries/operations'

const props = defineProps<{
  open: boolean
  product: Product | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  create: [input: CreateProductInput]
  update: [id: number, input: UpdateProductInput]
}>()

const isEditing = computed(() => props.product !== null)
const { data: products } = useProductsQuery()
const { data: productGroups } = useProductGroupsQuery()
const { data: settings } = useSettingsQuery()

const groupNames = computed(() => (productGroups.value ?? []).map((g) => g.name))

/** Default Bag Size options = current Default Bag Types catalog from Settings. */
const bagTypeCatalog = computed(() => settings.value?.bagTypes ?? [...SEED_BAG_SIZES])

const schema = toTypedSchema(
  z.object({
    name: z.string().trim().min(1, 'Name is required'),
    productGroupName: z.string().trim().min(1, 'Product Group is required'),
    type: z.enum(['packaged', 'bulk']),
    defaultBagSizeKg: z.string().optional().default(''),
    nameTe: z.string().trim().optional().default(''),
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
      const p = props.product
      resetForm({
        values: {
          name: p?.name ?? '',
          productGroupName: p?.productGroupName ?? '',
          type: p?.type ?? 'bulk',
          defaultBagSizeKg: p?.defaultBagSizeKg?.toString() ?? '',
          nameTe: p?.nameTe ?? '',
          remarks: p?.remarks ?? ''
        }
      })
    }
  }
)

const isBulk = computed(() => values.type === 'bulk')

const nameConflict = computed(() => {
  const name = values.name?.trim()
  if (!name) return false
  return isNameTaken(name, products.value ?? [], props.product?.id)
})

const bagSizeError = computed(() => {
  if (isBulk.value && !values.defaultBagSizeKg) {
    return 'Default Bag Size is required for Bulk Products'
  }
  return null
})

const onSubmit = handleSubmit((formValues) => {
  if (nameConflict.value) return
  if (isBulk.value && !formValues.defaultBagSizeKg) return

  if (isEditing.value && props.product) {
    emit('update', props.product.id, {
      name: formValues.name,
      productGroupName: formValues.productGroupName,
      nameTe: formValues.nameTe || null,
      remarks: formValues.remarks || null
    })
  } else {
    emit('create', {
      name: formValues.name,
      productGroupName: formValues.productGroupName,
      type: formValues.type,
      defaultBagSizeKg: isBulk.value ? Number(formValues.defaultBagSizeKg) : null,
      nameTe: formValues.nameTe || null,
      remarks: formValues.remarks || null
    })
  }
})
</script>

<template>
  <Dialog :open="open" @update:open="$emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg" data-testid="product-dialog">
      <DialogHeader>
        <DialogTitle>{{ isEditing ? 'Edit Product' : 'Add Product' }}</DialogTitle>
      </DialogHeader>

      <form class="grid gap-4 py-2" @submit.prevent="onSubmit">
        <!-- Name -->
        <div class="grid gap-2">
          <Label for="product-name">Name *</Label>
          <Input
            id="product-name"
            :model-value="values.name"
            placeholder="English name"
            data-testid="product-name-input"
            @update:model-value="setFieldValue('name', $event as string)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">{{ errors.name }}</p>
          <p v-if="nameConflict" class="text-sm text-destructive">
            A product with this name already exists
          </p>
        </div>

        <!-- Product Group -->
        <div class="grid gap-2">
          <Label>Product Group *</Label>
          <ComboboxField
            :model-value="values.productGroupName ?? ''"
            :options="groupNames"
            placeholder="Select or type a group..."
            test-id="product-group-combobox"
            @update:model-value="setFieldValue('productGroupName', $event)"
          />
          <p v-if="errors.productGroupName" class="text-sm text-destructive">
            {{ errors.productGroupName }}
          </p>
        </div>

        <!-- Type (immutable after creation) -->
        <div class="grid gap-2">
          <Label>Type *</Label>
          <div v-if="isEditing" class="flex items-center gap-2">
            <Badge variant="secondary" class="capitalize">{{ product?.type }}</Badge>
            <span class="text-xs text-muted-foreground">(cannot be changed)</span>
          </div>
          <Select
            v-else
            :model-value="values.type"
            @update:model-value="
              (v) => {
                setFieldValue('type', v as 'packaged' | 'bulk')
                if (v === 'packaged') setFieldValue('defaultBagSizeKg', '')
              }
            "
          >
            <SelectTrigger data-testid="product-type-select">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bulk">Bulk</SelectItem>
              <SelectItem value="packaged">Packaged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Default Bag Size (immutable after creation, only for Bulk) -->
        <div v-if="isBulk || (isEditing && product?.type === 'bulk')" class="grid gap-2">
          <Label>Default Bag Size *</Label>
          <div v-if="isEditing" class="flex items-center gap-2">
            <Badge variant="secondary">{{ product?.defaultBagSizeKg }} kg</Badge>
            <span class="text-xs text-muted-foreground">(cannot be changed)</span>
          </div>
          <Select
            v-else
            :model-value="values.defaultBagSizeKg"
            @update:model-value="setFieldValue('defaultBagSizeKg', $event as string)"
          >
            <SelectTrigger data-testid="product-bag-size-select">
              <SelectValue placeholder="Select bag size" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="size in bagTypeCatalog" :key="size" :value="String(size)">
                {{ size }} kg
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="bagSizeError && !isEditing" class="text-sm text-destructive">
            {{ bagSizeError }}
          </p>
        </div>

        <!-- Telugu Name -->
        <div class="grid gap-2">
          <Label for="product-name-te">
            Telugu Name
            <Badge v-if="!values.nameTe" variant="outline" class="ml-2 text-xs">missing</Badge>
          </Label>
          <Input
            id="product-name-te"
            :model-value="values.nameTe"
            placeholder="తెలుగు పేరు"
            data-testid="product-name-te-input"
            @update:model-value="setFieldValue('nameTe', $event as string)"
          />
        </div>

        <!-- Remarks -->
        <div class="grid gap-2">
          <Label for="product-remarks">Remarks</Label>
          <Input
            id="product-remarks"
            :model-value="values.remarks"
            placeholder="Optional notes"
            @update:model-value="setFieldValue('remarks', $event as string)"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="$emit('update:open', false)">
            Cancel
          </Button>
          <Button type="submit" :disabled="nameConflict" data-testid="product-submit">
            {{ isEditing ? 'Save Changes' : 'Add Product' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
