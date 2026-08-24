<script setup lang="ts">
import { computed, ref } from 'vue'
import { AlertTriangle, Boxes } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import InventoryProductLinesDialog from '@/components/inventory/InventoryProductLinesDialog.vue'
import { formatBagKg, formatStockQty } from '@/lib/format'
import { useInventoryQuery } from '@/queries/operations'
import { useProductsQuery } from '@/queries/products'
import { compareInventoryProductOrder } from '@domain/product'
import type { InventoryRow } from '@domain/transaction'

const { data: inventory, isLoading } = useInventoryQuery()
const { data: products } = useProductsQuery()

const search = ref('')
const groupFilter = ref<string[]>([])
const dialogOpen = ref(false)
const selectedProduct = ref<InventoryRow | null>(null)

const rows = computed(() => inventory.value ?? [])

const orderByProductId = computed(() => {
  const map = new Map<number, number | null>()
  for (const p of products.value ?? []) {
    map.set(p.id, p.inventoryOrder)
  }
  return map
})

const groupNames = computed(() =>
  [...new Set(rows.value.map((r) => r.productGroupName))].sort((a, b) => a.localeCompare(b))
)

const filtered = computed(() => {
  let list = rows.value

  if (search.value) {
    const q = search.value.toLowerCase()
    list = list.filter((r) => r.productName.toLowerCase().includes(q))
  }

  if (groupFilter.value.length > 0) {
    const set = new Set(groupFilter.value)
    list = list.filter((r) => set.has(r.productGroupName))
  }

  return list
})

const grouped = computed((): [string, InventoryRow[]][] => {
  const groups = new Map<string, InventoryRow[]>()
  const order = orderByProductId.value
  for (const row of filtered.value) {
    const list = groups.get(row.productGroupName) ?? []
    list.push(row)
    groups.set(row.productGroupName, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, items]) => {
      const sorted = [...items].sort((a, b) =>
        compareInventoryProductOrder(
          { inventoryOrder: order.get(a.productId) ?? null, name: a.productName },
          { inventoryOrder: order.get(b.productId) ?? null, name: b.productName }
        )
      )
      return [group, sorted]
    })
})

const hasNegative = computed(() => rows.value.some((r) => r.negative))
const printDisabled = computed(() => filtered.value.length === 0)

function toggleGroupFilter(group: string, checked: boolean): void {
  if (checked) groupFilter.value.push(group)
  else groupFilter.value = groupFilter.value.filter((g) => g !== group)
}

function openProduct(row: InventoryRow): void {
  selectedProduct.value = row
  dialogOpen.value = true
}

function printView(): void {
  // View print — not a Sale Invoice / Credit Voucher (ADR-0008).
  // Do not read settings.printerlessMode.
  window.print()
}

function unit(row: InventoryRow): string {
  return `bags of ${formatBagKg(row.defaultBagSizeG)}`
}

function stock(row: InventoryRow, qty: number): string {
  return formatStockQty(qty, row.defaultBagSizeG)
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8" data-testid="inventory-page">
    <div class="flex items-center gap-3">
      <Boxes class="size-6" />
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Inventory</h1>
        <p class="text-sm text-muted-foreground">
          Live stock computed from the day's transactions — not a stored value.
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3" data-print-hide>
      <Input
        v-model="search"
        placeholder="Search by name..."
        class="max-w-xs"
        data-testid="inventory-product-search"
      />

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="outline" size="sm" data-testid="inventory-group-filter">
            Group{{ groupFilter.length ? ` (${groupFilter.length})` : '' }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent class="max-h-64 overflow-y-auto">
          <DropdownMenuCheckboxItem
            v-for="group in groupNames"
            :key="group"
            :checked="groupFilter.includes(group)"
            @update:checked="(checked: boolean) => toggleGroupFilter(group, checked)"
          >
            {{ group }}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button data-testid="inventory-print" :disabled="printDisabled" @click="printView">
        Print
      </Button>
    </div>

    <div
      v-if="hasNegative"
      class="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
      data-testid="inventory-negative-warning"
      data-print-hide
    >
      <AlertTriangle class="size-4" />
      Some products project below zero. This usually means a Purchase or Stock Transfer was voided
      after its stock was sold — record a corrective transaction.
    </div>

    <div v-if="isLoading" class="py-8 text-center text-muted-foreground">Loading...</div>
    <div v-else-if="rows.length === 0" class="py-8 text-center text-muted-foreground">
      No products in the catalog yet.
    </div>
    <div v-else-if="filtered.length === 0" class="py-8 text-center text-muted-foreground">
      No matches
    </div>

    <div v-else data-print="stock" class="flex flex-col gap-6">
      <div v-for="[group, items] in grouped" :key="group" class="space-y-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {{ group }}
        </h2>
        <div class="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead class="text-right">Opening</TableHead>
                <TableHead class="text-right">+ Purchased</TableHead>
                <TableHead class="text-right">− Sold</TableHead>
                <TableHead class="text-right">± Transfer</TableHead>
                <TableHead class="text-right">= Closing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow
                v-for="row in items"
                :key="row.productId"
                data-testid="inventory-row"
                role="button"
                tabindex="0"
                :aria-label="`Show live lines for ${row.productName}`"
                class="cursor-pointer"
                @click="openProduct(row)"
                @keydown.enter.prevent="openProduct(row)"
                @keydown.space.prevent="openProduct(row)"
              >
                <TableCell class="font-medium">
                  {{ row.productName }}
                  <span class="text-xs text-muted-foreground">({{ unit(row) }})</span>
                </TableCell>
                <TableCell class="text-right tabular-nums">{{ stock(row, row.opening) }}</TableCell>
                <TableCell class="text-right tabular-nums">{{
                  stock(row, row.purchased)
                }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ stock(row, row.sold) }}</TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ stock(row, row.transferIn - row.transferOut) }}
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums">
                  <span :class="row.negative ? 'text-destructive' : ''">{{
                    stock(row, row.closing)
                  }}</span>
                  <Badge v-if="row.negative" variant="secondary" class="ml-1 text-xs"
                    >negative</Badge
                  >
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>

    <InventoryProductLinesDialog v-model:open="dialogOpen" :product="selectedProduct" />
  </div>
</template>
