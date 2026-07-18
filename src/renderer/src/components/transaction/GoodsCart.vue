<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
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
import NumericField from '@/components/NumericField.vue'
import { emptyCartLine, type CartLine } from '@/components/transaction/cart-line'
import { formatBagKg, formatKgFromG, formatRupees } from '@/lib/format'
import { lineMassGrams, lineTotal } from '@domain/transaction-rules'
import type { Product } from '@domain/types'

export type { CartLine }

type Focusable = { focus: () => void }

const props = defineProps<{
  products: Product[]
  /** Bag Types in grams. */
  bagTypes: number[]
}>()

const lines = defineModel<CartLine[]>({ required: true })

const productMap = computed(() => new Map(props.products.map((p) => [p.id, p])))
const productOptions = computed<ComboboxOption[]>(() =>
  props.products.map((p) => ({
    value: p.id,
    label: p.name,
    hint: formatBagKg(p.defaultBagSizeG)
  }))
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
  // NumericField exposes focus(); fall back to $el for plain inputs.
  const comp = el as Focusable & { $el?: HTMLElement }
  if (typeof comp.focus === 'function') {
    qtyInputRefs.value[index] = comp
    return
  }
  const target = comp.$el ?? el
  qtyInputRefs.value[index] =
    target != null && typeof (target as Focusable).focus === 'function'
      ? (target as Focusable)
      : null
}

function productOf(line: CartLine): Product | undefined {
  return line.productId == null ? undefined : productMap.value.get(line.productId)
}

function rowTotal(line: CartLine): number {
  if (!line.productId || !line.qty) return 0
  return lineTotal({
    isLoose: line.isLoose,
    qty: line.qty,
    bagSizeG: line.bagSizeG,
    quintalRate: line.quintalRate,
    perKgRate: line.perKgRate
  })
}

function rowMassG(line: CartLine): number {
  if (!line.productId || !line.qty) return 0
  return lineMassGrams({
    isLoose: line.isLoose,
    qty: line.qty,
    bagSizeG: line.bagSizeG
  })
}

function addLine(): void {
  lines.value = [...lines.value, emptyCartLine()]
}

/**
 * Customer Master pick — ensure a first line exists, then open its product
 * picker only when that line is still empty (no Product). Leave focus alone if
 * the first product line already has a Product. Does not reseed after remove.
 */
function ensureLineAndFocusProduct(): void {
  if (lines.value.length === 0) {
    addLine()
  }
  if (lines.value[0]?.productId != null) return
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
  if (!line.isLoose) {
    line.bagSizeG = p?.defaultBagSizeG ?? null
  }
  if (value != null) focusQty(index)
}

/** Select value for the Bag / Loose column: bag grams as string, or "loose". */
const LOOSE_SELECT_VALUE = 'loose'

function bagOrLooseValue(line: CartLine): string {
  if (line.isLoose) return LOOSE_SELECT_VALUE
  return line.bagSizeG == null ? '' : String(line.bagSizeG)
}

function onBagOrLooseChange(line: CartLine, value: unknown): void {
  const v = String(value ?? '')
  if (v === LOOSE_SELECT_VALUE) {
    line.isLoose = true
    line.bagSizeG = null
    line.quintalRate = null
    return
  }
  line.isLoose = false
  line.perKgRate = null
  line.bagSizeG = v === '' ? null : Number(v)
}

defineExpose({ ensureLineAndFocusProduct })
</script>

<template>
  <div class="rounded-md border" data-testid="goods-cart">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="min-w-[180px]">Product</TableHead>
          <TableHead class="w-[130px]">Bag / Loose</TableHead>
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
              :model-value="bagOrLooseValue(line)"
              @update:model-value="onBagOrLooseChange(line, $event)"
            >
              <SelectTrigger class="w-full" data-testid="cart-bag">
                <SelectValue placeholder="Bag / Loose" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="b in bagTypes" :key="b" :value="String(b)">{{
                  formatBagKg(b)
                }}</SelectItem>
                <SelectItem :value="LOOSE_SELECT_VALUE" data-testid="cart-loose">Loose</SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
          <TableCell>
            <NumericField
              :ref="(el) => setQtyInputRef(index, el)"
              mode="qty"
              :model-value="line.qty"
              :placeholder="line.isLoose ? 'kg' : 'bags'"
              test-id="cart-qty"
              @update:model-value="line.qty = $event"
            />
          </TableCell>
          <TableCell>
            <NumericField
              v-if="line.isLoose"
              mode="money"
              :model-value="line.perKgRate"
              placeholder="₹/kg"
              test-id="cart-rate"
              @update:model-value="line.perKgRate = $event"
            />
            <NumericField
              v-else
              mode="money"
              :model-value="line.quintalRate"
              placeholder="₹/quintal"
              test-id="cart-rate"
              @update:model-value="line.quintalRate = $event"
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
