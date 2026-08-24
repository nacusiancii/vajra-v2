<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatBagKg, formatQty, formatRupees } from '@/lib/format'
import { txnCounterparty } from '@/lib/txn-edit'
import { useProductLiveLinesQuery } from '@/queries/transactions'
import { TXN_TYPE_LABELS, type InventoryRow, type ProductLiveLine } from '@domain/transaction'

const props = defineProps<{
  open: boolean
  product: InventoryRow | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const productId = computed(() => (props.open ? (props.product?.productId ?? null) : null))
const { data: lines } = useProductLiveLinesQuery(productId)
const items = computed(() => lines.value ?? [])
const showLoading = computed(() => props.open && lines.value === undefined)

function printView(): void {
  // View print — not a Sale Invoice / Credit Voucher (ADR-0008).
  // Do not read settings.printerlessMode.
  window.print()
}

function partyName(line: ProductLiveLine): string {
  return txnCounterparty({
    customerName: line.customerName,
    walkinName: line.walkinName,
    label: null
  })
}

function typeLabel(line: ProductLiveLine): string {
  if (line.type === 'ST') {
    return `Stock Transfer (${line.side})`
  }
  return `${line.saleMode === 'credit' ? 'Credit' : 'Cash'} ${TXN_TYPE_LABELS[line.type]}`
}

function quantityLabel(line: ProductLiveLine): string {
  if (line.isLoose) return `${formatQty(line.qty)} kg`
  return `${formatQty(line.qty)} bags of ${formatBagKg(line.bagSizeG ?? 0)}`
}

function rateLabel(line: ProductLiveLine): string {
  if (line.type === 'ST') return '—'
  if (line.isLoose) return `${formatRupees(line.perKgRate ?? 0)} /kg`
  return formatRupees(line.quintalRate ?? 0)
}

function totalLabel(line: ProductLiveLine): string {
  if (line.type === 'ST') return '—'
  return formatRupees(line.lineTotal)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      v-if="open && product"
      class="sm:max-w-5xl max-h-[90vh] overflow-y-auto"
      data-testid="inventory-product-dialog"
    >
      <DialogHeader>
        <DialogTitle>{{ product.productName }}</DialogTitle>
        <DialogDescription>
          {{ product.productGroupName }} · bags of {{ formatBagKg(product.defaultBagSizeG) }}
        </DialogDescription>
      </DialogHeader>
      <p class="text-sm text-muted-foreground">
        Live Sales, Purchases, and Stock Transfers for this Product today. Total is the Product line
        only.
      </p>
      <div class="rounded-md border">
        <Table data-testid="inventory-product-lines">
          <TableHeader>
            <TableRow>
              <TableHead class="text-right">Sl. No.</TableHead>
              <TableHead>Party Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead class="text-right">Quantity</TableHead>
              <TableHead class="text-right">Quintal Rate</TableHead>
              <TableHead class="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="showLoading">
              <TableCell :colspan="6" class="py-8 text-center text-muted-foreground">
                Loading...
              </TableCell>
            </TableRow>
            <TableRow v-else-if="items.length === 0">
              <TableCell
                :colspan="6"
                class="py-8 text-center text-muted-foreground"
                data-testid="inventory-product-empty"
              >
                No live Sales, Purchases, or Stock Transfers for this Product today.
              </TableCell>
            </TableRow>
            <template v-else>
              <TableRow
                v-for="(line, index) in items"
                :key="line.lineId"
                data-testid="inventory-product-line"
              >
                <TableCell class="text-right tabular-nums">{{ index + 1 }}</TableCell>
                <TableCell class="whitespace-normal">{{ partyName(line) }}</TableCell>
                <TableCell class="whitespace-normal">{{ typeLabel(line) }}</TableCell>
                <TableCell class="whitespace-normal text-right tabular-nums">{{
                  quantityLabel(line)
                }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ rateLabel(line) }}</TableCell>
                <TableCell class="text-right tabular-nums">{{ totalLabel(line) }}</TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>
      <DialogFooter data-print-hide>
        <Button data-testid="inventory-product-print" @click="printView">Print</Button>
        <Button variant="outline" @click="emit('update:open', false)">Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
