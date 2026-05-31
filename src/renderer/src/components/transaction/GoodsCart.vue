<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import EntityCombobox, { type ComboboxOption } from '@/components/EntityCombobox.vue'
import { formatRupees } from '@/lib/format'
import { lineKg, lineTotal } from '@domain/transaction-rules'
import type { Product } from '@domain/types'

/** A cart line while being edited — rates may be empty until typed. */
export interface CartLine {
  productId: number | null
  bagSizeKg: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number | null
}

const props = defineProps<{
  products: Product[]
  bagTypes: number[]
}>()

const lines = defineModel<CartLine[]>({ required: true })

const productMap = computed(() => new Map(props.products.map((p) => [p.id, p])))
const productOptions = computed<ComboboxOption[]>(() =>
  props.products.map((p) => ({ value: p.id, label: p.name, hint: p.type }))
)

function productOf(line: CartLine): Product | undefined {
  return line.productId == null ? undefined : productMap.value.get(line.productId)
}

function isBulk(line: CartLine): boolean {
  return productOf(line)?.type === 'bulk'
}

function rowTotal(line: CartLine): number {
  const p = productOf(line)
  if (!p || !line.qty) return 0
  return lineTotal({
    productType: p.type,
    qty: line.qty,
    bagSizeKg: line.bagSizeKg,
    quintalRate: line.quintalRate,
    unitRate: line.unitRate
  })
}

function rowKg(line: CartLine): number {
  const p = productOf(line)
  if (!p || !line.qty) return 0
  return lineKg(p.type, line.qty, line.bagSizeKg)
}

function addLine(): void {
  lines.value = [
    ...lines.value,
    { productId: null, bagSizeKg: null, quintalRate: null, unitRate: null, qty: null }
  ]
}

function removeLine(index: number): void {
  lines.value = lines.value.filter((_, i) => i !== index)
}

function onProductChange(line: CartLine, value: number | null): void {
  line.productId = value
  const p = productOf(line)
  // Default a Bulk line's bag size to the Product's Default Bag Size; clear for Packaged.
  line.bagSizeKg = p?.type === 'bulk' ? (p.defaultBagSizeKg ?? null) : null
}
</script>

<template>
  <div class="rounded-md border" data-testid="goods-cart">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="min-w-[180px]">Product</TableHead>
          <TableHead class="w-[110px]">Bag Type</TableHead>
          <TableHead class="w-[120px]">Rate</TableHead>
          <TableHead class="w-[90px]">Qty</TableHead>
          <TableHead class="w-[110px] text-right">Total</TableHead>
          <TableHead class="w-[48px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="lines.length === 0">
          <TableCell :colspan="6" class="py-6 text-center text-muted-foreground">
            No lines yet — add one to begin.
          </TableCell>
        </TableRow>
        <TableRow v-for="(line, index) in lines" :key="index" data-testid="cart-line">
          <TableCell>
            <EntityCombobox
              :model-value="line.productId"
              :options="productOptions"
              placeholder="Select product"
              search-placeholder="Type a product name…"
              empty-text="No product matches."
              test-id="cart-product"
              @update:model-value="onProductChange(line, $event)"
            />
          </TableCell>
          <TableCell>
            <Select
              v-if="isBulk(line)"
              :model-value="line.bagSizeKg == null ? '' : String(line.bagSizeKg)"
              @update:model-value="line.bagSizeKg = Number($event)"
            >
              <SelectTrigger class="w-full" data-testid="cart-bag">
                <SelectValue placeholder="Bag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="b in bagTypes" :key="b" :value="String(b)"
                  >{{ b }} kg</SelectItem
                >
              </SelectContent>
            </Select>
            <span v-else class="text-sm text-muted-foreground">unit</span>
          </TableCell>
          <TableCell>
            <Input
              v-if="isBulk(line)"
              type="number"
              min="0"
              :model-value="line.quintalRate ?? ''"
              placeholder="₹/quintal"
              data-testid="cart-rate"
              @update:model-value="line.quintalRate = $event === '' ? null : Number($event)"
            />
            <Input
              v-else
              type="number"
              min="0"
              :model-value="line.unitRate ?? ''"
              placeholder="₹/unit"
              data-testid="cart-rate"
              @update:model-value="line.unitRate = $event === '' ? null : Number($event)"
            />
          </TableCell>
          <TableCell>
            <Input
              type="number"
              min="0"
              step="0.5"
              :model-value="line.qty ?? ''"
              data-testid="cart-qty"
              @update:model-value="line.qty = $event === '' ? null : Number($event)"
            />
          </TableCell>
          <TableCell class="text-right tabular-nums">
            <div>{{ formatRupees(rowTotal(line)) }}</div>
            <div v-if="rowKg(line) > 0" class="text-xs text-muted-foreground">
              {{ rowKg(line) }} kg
            </div>
          </TableCell>
          <TableCell>
            <Button
              variant="ghost"
              size="icon"
              data-testid="cart-remove"
              @click="removeLine(index)"
            >
              <Trash2 class="size-4 text-destructive" />
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
    <div class="border-t p-2">
      <Button variant="outline" size="sm" data-testid="cart-add-line" @click="addLine">
        <Plus class="mr-2 size-4" />
        Add Line
      </Button>
    </div>
  </div>
</template>
