<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangle, Boxes } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useInventoryQuery } from '@/queries/operations'
import { formatBagKg, formatStockQty } from '@/lib/format'
import type { InventoryRow } from '@domain/transaction'

const { data: inventory, isLoading } = useInventoryQuery()

const rows = computed(() => inventory.value ?? [])
const grouped = computed(() => {
  const groups = new Map<string, InventoryRow[]>()
  for (const row of rows.value) {
    const list = groups.get(row.productGroupName) ?? []
    list.push(row)
    groups.set(row.productGroupName, list)
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})
const hasNegative = computed(() => rows.value.some((r) => r.negative))

function unit(row: InventoryRow): string {
  return row.productType === 'bulk' && row.defaultBagSizeG
    ? `bags of ${formatBagKg(row.defaultBagSizeG)}`
    : 'units'
}

function stock(row: InventoryRow, qty: number): string {
  return formatStockQty(qty, row.productType, row.defaultBagSizeG)
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

    <div
      v-if="hasNegative"
      class="flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200"
      data-testid="inventory-negative-warning"
    >
      <AlertTriangle class="size-4" />
      Some products project below zero. This usually means a Purchase or Stock Transfer was voided
      after its stock was sold — record a corrective transaction.
    </div>

    <div v-if="isLoading" class="py-8 text-center text-muted-foreground">Loading...</div>
    <div v-else-if="rows.length === 0" class="py-8 text-center text-muted-foreground">
      No products in the catalog yet.
    </div>

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
            <TableRow v-for="row in items" :key="row.productId" data-testid="inventory-row">
              <TableCell class="font-medium">
                {{ row.productName }}
                <span class="text-xs text-muted-foreground">({{ unit(row) }})</span>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ stock(row, row.opening) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ stock(row, row.purchased) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ stock(row, row.sold) }}</TableCell>
              <TableCell class="text-right tabular-nums">
                {{ stock(row, row.transferIn - row.transferOut) }}
              </TableCell>
              <TableCell class="text-right font-semibold tabular-nums">
                <span :class="row.negative ? 'text-destructive' : ''">{{
                  stock(row, row.closing)
                }}</span>
                <Badge v-if="row.negative" variant="secondary" class="ml-1 text-xs">negative</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
