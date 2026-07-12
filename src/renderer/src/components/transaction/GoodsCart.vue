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
import { LOOSE_QTY_MAX_KG, LOOSE_QTY_MIN_KG } from '@domain/units'
import type { Product } from '@domain/types'

/** A cart line while being edited — rates may be empty until typed. Rates are paise; bag sizes grams. */
export interface CartLine {
  productId: number | null
  /** Loose bulk: qty in kg, unitRate paise/kg. Bagged bulk uses Default Bag Size + quintal rate. */
  isLoose: boolean
  bagSizeG: number | null
  quintalRate: number | null
  unitRate: number | null
  qty: number | null
}

type Focusable = { focus: () => void }

const props = defineProps<{
  products: Product[]
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

function emptyLine(): CartLine {
  return {
    productId: null,
    isLoose: false,
    bagSizeG: null,
    quintalRate: null,
    unitRate: null,
    qty: null
  }
}

function rowTotal(line: CartLine): number {
  const p = productOf(line)
  if (!p || !line.qty) return 0
  return lineTotal({
    productType: p.type,
    qty: line.qty,
    bagSizeG: line.bagSizeG,
    quintalRate: line.quintalRate,
    unitRate: line.unitRate,
    isLoose: line.isLoose
  })
}

function rowMassG(line: CartLine): number {
  const p = productOf(line)
  if (!p || !line.qty) return 0
  return lineMassGrams(p.type, line.qty, line.bagSizeG, line.isLoose)
}

function addLine(): void {
  lines.value = [...lines.value, emptyLine()]
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
  line.isLoose = false
  // Bagged bulk snapshots the Product's Default Bag Size; clear for Packaged.
  line.bagSizeG = p?.type === 'bulk' ? (p.defaultBagSizeG ?? null) : null
  line.quintalRate = null
  line.unitRate = null
  if (value != null) focusQty(index)
}

function onBulkModeChange(line: CartLine, mode: string): void {
  const loose = mode === 'loose'
  line.isLoose = loose
  const p = productOf(line)
  if (loose) {
    line.bagSizeG = null
    line.quintalRate = null
  } else {
    line.bagSizeG = p?.defaultBagSizeG ?? null
    line.unitRate = null
  }
}

defineExpose({ ensureLineAndFocusProduct })
</script>

<template>
  <div class="rounded-md border" data-testid="goods-cart">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="min-w-[160px]">Product</TableHead>
          <TableHead class="w-[110px]">Mode</TableHead>
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
              :model-value="line.isLoose ? 'loose' : 'bag'"
              @update:model-value="onBulkModeChange(line, String($event))"
            >
              <SelectTrigger class="w-full" data-testid="cart-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bag">
                  Bag{{
                    line.bagSizeG || productOf(line)?.defaultBagSizeG
                      ? ` (${formatBagKg(line.bagSizeG ?? productOf(line)?.defaultBagSizeG ?? 0)})`
                      : ''
                  }}
                </SelectItem>
                <SelectItem value="loose">Loose</SelectItem>
              </SelectContent>
            </Select>
            <span v-else class="text-sm text-muted-foreground">unit</span>
          </TableCell>
          <TableCell>
            <Input
              :ref="(el) => setQtyInputRef(index, el)"
              type="number"
              min="0"
              :step="line.isLoose ? '0.1' : '0.5'"
              :model-value="line.qty ?? ''"
              :placeholder="line.isLoose ? 'kg' : undefined"
              data-testid="cart-qty"
              @update:model-value="line.qty = $event === '' ? null : Number($event)"
            />
            <p
              v-if="line.isLoose"
              class="mt-0.5 text-[10px] text-muted-foreground"
              data-testid="cart-loose-hint"
            >
              {{ LOOSE_QTY_MIN_KG }}–{{ LOOSE_QTY_MAX_KG }} kg
            </p>
          </TableCell>
          <TableCell>
            <Input
              v-if="isBulk(line) && line.isLoose"
              type="number"
              min="0"
              :model-value="paiseInputValue(line.unitRate)"
              placeholder="₹/kg"
              data-testid="cart-rate"
              @update:model-value="line.unitRate = parseRupeesInput($event)"
            />
            <Input
              v-else-if="isBulk(line)"
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
