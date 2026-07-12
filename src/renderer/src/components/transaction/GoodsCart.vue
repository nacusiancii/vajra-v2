<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
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
import { formatBagKg, formatKgFromG, formatRupees } from '@/lib/format'
import { parseRupeesInput, paiseInputValue } from '@/lib/money-input'
import { lineMassGrams, lineTotal } from '@domain/transaction-rules'
import type { Product } from '@domain/types'

/** A cart line while being edited — rates may be empty until typed. Rates are paise; bag sizes grams. */
export interface CartLine {
  productId: number | null
  bagSizeG: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number | null
}

type Focusable = { focus: () => void }

const props = defineProps<{
  products: Product[]
  /** Bag Types in grams. */
  bagTypes: number[]
}>()

const lines = defineModel<CartLine[]>({ required: true })

const productMap = computed(() => new Map(props.products.map((p) => [p.id, p])))
const productOptions = computed<ComboboxOption[]>(() =>
  props.products.map((p) => ({ value: p.id, label: p.name, hint: p.type }))
)

/** Product comboboxes by row — used to open the picker after auto-adding a line. */
const productComboRefs = ref<(Focusable | null)[]>([])
/** Qty inputs by row — focused after a product is chosen. */
const qtyInputRefs = ref<(Focusable | null)[]>([])

function setProductComboRef(index: number, el: unknown): void {
  productComboRefs.value[index] = el != null ? (el as Focusable) : null
}

function setQtyInputRef(index: number, el: unknown): void {
  if (el == null) {
    qtyInputRefs.value[index] = null
    return
  }
  // Input.vue is a single-root component — use $el when given a component instance.
  const target = (el as { $el?: HTMLElement }).$el ?? el
  qtyInputRefs.value[index] =
    target != null && typeof (target as Focusable).focus === 'function'
      ? (target as Focusable)
      : null
}

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
    bagSizeG: line.bagSizeG,
    quintalRate: line.quintalRate,
    unitRate: line.unitRate
  })
}

function rowMassG(line: CartLine): number {
  const p = productOf(line)
  if (!p || !line.qty) return 0
  return lineMassGrams(p.type, line.qty, line.bagSizeG)
}

function addLine(): void {
  lines.value = [
    ...lines.value,
    { productId: null, bagSizeG: null, quintalRate: null, unitRate: null, qty: null }
  ]
}

/** Empty cart after customer pick — start the first line and open its product picker. */
function ensureLineAndFocusProduct(): void {
  if (lines.value.length > 0) return
  addLine()
  void nextTick(() => productComboRefs.value[0]?.focus())
}

function removeLine(index: number): void {
  lines.value = lines.value.filter((_, i) => i !== index)
  productComboRefs.value.splice(index, 1)
  qtyInputRefs.value.splice(index, 1)
}

function focusQty(index: number): void {
  // EntityCombobox skips close-auto-focus after a pick; land on qty once the
  // popover has released focus (same setTimeout(0) handoff pattern).
  void nextTick(() => {
    window.setTimeout(() => qtyInputRefs.value[index]?.focus(), 0)
  })
}

function onProductChange(line: CartLine, value: number | null, index: number): void {
  line.productId = value
  const p = productOf(line)
  // Default a Bulk line's bag size to the Product's Default Bag Size; clear for Packaged.
  line.bagSizeG = p?.type === 'bulk' ? (p.defaultBagSizeG ?? null) : null
  if (value != null) focusQty(index)
}

defineExpose({ ensureLineAndFocusProduct })
</script>

<template>
  <div class="rounded-md border" data-testid="goods-cart">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="min-w-[180px]">Product</TableHead>
          <TableHead class="w-[110px]">Bag Type</TableHead>
          <TableHead class="w-[90px]">Qty</TableHead>
          <TableHead class="w-[120px]">Rate</TableHead>
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
              :ref="(el) => setProductComboRef(index, el)"
              :model-value="line.productId"
              :options="productOptions"
              placeholder="Select product"
              search-placeholder="Type a product name…"
              empty-text="No product matches."
              test-id="cart-product"
              @update:model-value="onProductChange(line, $event, index)"
            />
          </TableCell>
          <TableCell>
            <Select
              v-if="isBulk(line)"
              :model-value="line.bagSizeG == null ? '' : String(line.bagSizeG)"
              @update:model-value="line.bagSizeG = Number($event)"
            >
              <SelectTrigger class="w-full" data-testid="cart-bag">
                <SelectValue placeholder="Bag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="b in bagTypes" :key="b" :value="String(b)">{{
                  formatBagKg(b)
                }}</SelectItem>
              </SelectContent>
            </Select>
            <span v-else class="text-sm text-muted-foreground">unit</span>
          </TableCell>
          <TableCell>
            <Input
              :ref="(el) => setQtyInputRef(index, el)"
              type="number"
              min="0"
              step="0.5"
              :model-value="line.qty ?? ''"
              data-testid="cart-qty"
              @update:model-value="line.qty = $event === '' ? null : Number($event)"
            />
          </TableCell>
          <TableCell>
            <Input
              v-if="isBulk(line)"
              type="number"
              min="0"
              :model-value="paiseInputValue(line.quintalRate)"
              placeholder="₹/quintal"
              data-testid="cart-rate"
              @update:model-value="line.quintalRate = parseRupeesInput($event)"
            />
            <Input
              v-else
              type="number"
              min="0"
              :model-value="paiseInputValue(line.unitRate)"
              placeholder="₹/unit"
              data-testid="cart-rate"
              @update:model-value="line.unitRate = parseRupeesInput($event)"
            />
          </TableCell>
          <TableCell class="text-right tabular-nums">
            <div>{{ formatRupees(rowTotal(line)) }}</div>
            <div v-if="rowMassG(line) > 0" class="text-xs text-muted-foreground">
              {{ formatKgFromG(rowMassG(line)) }}
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
