<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Pencil, Trash2, AlertCircle } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import ProductDialog from '@/components/product/ProductDialog.vue'
import { useProductMasterStore } from '@/stores/product-master'
import {
  useProductsQuery,
  useProductGroupsQuery,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct
} from '@/queries/products'
import type { CreateProductInput, UpdateProductInput } from '@domain/types'

const store = useProductMasterStore()
const { data: products, isLoading } = useProductsQuery()
const { data: productGroups } = useProductGroupsQuery()
const createMutation = useCreateProduct()
const updateMutation = useUpdateProduct()
const deleteMutation = useDeleteProduct()

const groupNames = computed(() => (productGroups.value ?? []).map((g) => g.name))

const filtered = computed(() => {
  let list = products.value ?? []

  if (store.search) {
    const q = store.search.toLowerCase()
    list = list.filter((p) => p.name.toLowerCase().includes(q))
  }

  if (store.groupFilter.length > 0) {
    const set = new Set(store.groupFilter)
    list = list.filter((p) => set.has(p.productGroupName))
  }

  if (store.translationFilter === 'missing') {
    list = list.filter((p) => !p.nameTe)
  }

  if (store.sortField === 'updatedAt') {
    list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  return list
})

function handleCreate(input: CreateProductInput): void {
  createMutation.mutate(input, { onSuccess: () => store.closeDialog() })
}

function handleUpdate(id: number, input: UpdateProductInput): void {
  updateMutation.mutate({ id, input }, { onSuccess: () => store.closeDialog() })
}

function handleDelete(id: number): void {
  deleteMutation.mutate(id)
}

function toggleGroupFilter(group: string, checked: boolean): void {
  if (checked) store.groupFilter.push(group)
  else store.groupFilter = store.groupFilter.filter((g) => g !== group)
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8"
    data-testid="product-master-page"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Product Master</h1>
        <p class="text-sm text-muted-foreground">
          {{ (products ?? []).length }} product{{ (products ?? []).length === 1 ? '' : 's' }}
        </p>
      </div>
      <Button data-testid="add-product-btn" @click="store.openCreateDialog()">
        <Plus class="mr-2 size-4" />
        Add Product
      </Button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <Input
        v-model="store.search"
        placeholder="Search by name..."
        class="max-w-xs"
        data-testid="product-search"
      />

      <!-- Product Group filter (multi-select) -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm">
            Group{{ store.groupFilter.length ? ` (${store.groupFilter.length})` : '' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="max-h-64 overflow-y-auto">
          <DropdownMenuCheckboxItem
            v-for="group in groupNames"
            :key="group"
            :checked="store.groupFilter.includes(group)"
            @update:checked="(checked: boolean) => toggleGroupFilter(group, checked)"
          >
            {{ group }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <!-- Translation filter -->
      <Select v-model="store.translationFilter">
        <SelectTrigger class="w-[160px]">
          <SelectValue placeholder="Translation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="missing">Missing Translation</SelectItem>
        </SelectContent>
      </Select>

      <!-- Sort -->
      <Select v-model="store.sortField">
        <SelectTrigger class="w-[150px]">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name">Name (A–Z)</SelectItem>
          <SelectItem value="updatedAt">Last Updated</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Table -->
    <div class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Bag Size</TableHead>
            <TableHead>Telugu</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead class="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell :colspan="7" class="py-8 text-center text-muted-foreground">
              Loading...
            </TableCell>
          </TableRow>
          <TableRow v-else-if="filtered.length === 0">
            <TableCell :colspan="7" class="py-8 text-center text-muted-foreground">
              {{ (products ?? []).length === 0 ? 'No products yet' : 'No matches' }}
            </TableCell>
          </TableRow>
          <TableRow v-for="product in filtered" :key="product.id" data-testid="product-row">
            <TableCell class="font-medium">{{ product.name }}</TableCell>
            <TableCell>{{ product.productGroupName }}</TableCell>
            <TableCell>
              <Badge variant="secondary" class="capitalize">{{ product.type }}</Badge>
            </TableCell>
            <TableCell>
              {{ product.defaultBagSizeKg ? `${product.defaultBagSizeKg} kg` : '—' }}
            </TableCell>
            <TableCell>
              <TooltipProvider v-if="!product.nameTe">
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle class="size-4 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>Telugu name missing</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge v-else variant="outline" class="text-xs text-green-600">OK</Badge>
            </TableCell>
            <TableCell class="max-w-[200px] truncate">
              {{ product.remarks || '—' }}
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="edit-product-btn"
                  @click="store.openEditDialog(product)"
                >
                  <Pencil class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="delete-product-btn"
                  @click="handleDelete(product.id)"
                >
                  <Trash2 class="size-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Dialog -->
    <ProductDialog
      :open="store.dialogOpen"
      :product="store.editingProduct"
      @update:open="(v) => (v ? null : store.closeDialog())"
      @create="handleCreate"
      @update="handleUpdate"
    />
  </div>
</template>
