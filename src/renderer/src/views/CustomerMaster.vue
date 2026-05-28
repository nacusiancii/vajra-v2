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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import CustomerDialog from '@/components/customer/CustomerDialog.vue'
import { useCustomerMasterStore } from '@/stores/customer-master'
import {
  useCustomersQuery,
  usePlacesQuery,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer
} from '@/queries/customers'
import type { CreateCustomerInput, UpdateCustomerInput, Customer } from '@domain/types'

const store = useCustomerMasterStore()
const { data: customers, isLoading } = useCustomersQuery()
const { data: places } = usePlacesQuery()
const createMutation = useCreateCustomer()
const updateMutation = useUpdateCustomer()
const deleteMutation = useDeleteCustomer()

const placeNames = computed(() => (places.value ?? []).map((p) => p.name))

const filtered = computed(() => {
  let list = customers.value ?? []

  if (store.search) {
    const q = store.search.toLowerCase()
    list = list.filter((c) => c.name.toLowerCase().includes(q))
  }

  if (store.placeFilter.length > 0) {
    const set = new Set(store.placeFilter)
    list = list.filter((c) => set.has(c.placeName))
  }

  if (store.translationFilter === 'missing') {
    list = list.filter((c) => !c.nameTe || !c.placeTe)
  }

  if (store.sortField === 'updatedAt') {
    list = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  return list
})

function isMissingTranslation(c: Customer): boolean {
  return !c.nameTe || !c.placeTe
}

function handleCreate(input: CreateCustomerInput) {
  createMutation.mutate(input, { onSuccess: () => store.closeDialog() })
}

function handleUpdate(id: number, input: UpdateCustomerInput) {
  updateMutation.mutate({ id, input }, { onSuccess: () => store.closeDialog() })
}

function handleDelete(id: number) {
  deleteMutation.mutate(id)
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8"
    data-testid="customer-master-page"
  >
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Customer Master</h1>
        <p class="text-sm text-muted-foreground">
          {{ (customers ?? []).length }} customer{{ (customers ?? []).length === 1 ? '' : 's' }}
        </p>
      </div>
      <Button @click="store.openCreateDialog()" data-testid="add-customer-btn">
        <Plus class="mr-2 size-4" />
        Add Customer
      </Button>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3">
      <Input
        v-model="store.search"
        placeholder="Search by name..."
        class="max-w-xs"
        data-testid="customer-search"
      />

      <!-- Place filter (multi-select) -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm">
            Place{{ store.placeFilter.length ? ` (${store.placeFilter.length})` : '' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="max-h-64 overflow-y-auto">
          <DropdownMenuCheckboxItem
            v-for="place in placeNames"
            :key="place"
            :checked="store.placeFilter.includes(place)"
            @update:checked="
              (checked) => {
                if (checked) store.placeFilter.push(place)
                else store.placeFilter = store.placeFilter.filter((p) => p !== place)
              }
            "
          >
            {{ place }}
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
            <TableHead>Place</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Telugu</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead class="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
            <TableCell :colspan="6" class="py-8 text-center text-muted-foreground">
              Loading...
            </TableCell>
          </TableRow>
          <TableRow v-else-if="filtered.length === 0">
            <TableCell :colspan="6" class="py-8 text-center text-muted-foreground">
              {{ (customers ?? []).length === 0 ? 'No customers yet' : 'No matches' }}
            </TableCell>
          </TableRow>
          <TableRow
            v-for="customer in filtered"
            :key="customer.id"
            data-testid="customer-row"
          >
            <TableCell class="font-medium">{{ customer.name }}</TableCell>
            <TableCell>{{ customer.placeName }}</TableCell>
            <TableCell>{{ customer.phone || '—' }}</TableCell>
            <TableCell>
              <TooltipProvider v-if="isMissingTranslation(customer)">
                <Tooltip>
                  <TooltipTrigger>
                    <AlertCircle class="size-4 text-yellow-500" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <span v-if="!customer.nameTe && !customer.placeTe">
                      Telugu name and place missing
                    </span>
                    <span v-else-if="!customer.nameTe">Telugu name missing</span>
                    <span v-else>Telugu place missing</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge v-else variant="outline" class="text-xs text-green-600">OK</Badge>
            </TableCell>
            <TableCell class="max-w-[200px] truncate">
              {{ customer.remarks || '—' }}
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  @click="store.openEditDialog(customer)"
                  data-testid="edit-customer-btn"
                >
                  <Pencil class="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  @click="handleDelete(customer.id)"
                  data-testid="delete-customer-btn"
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
    <CustomerDialog
      :open="store.dialogOpen"
      :customer="store.editingCustomer"
      @update:open="(v) => (v ? null : store.closeDialog())"
      @create="handleCreate"
      @update="handleUpdate"
    />
  </div>
</template>
