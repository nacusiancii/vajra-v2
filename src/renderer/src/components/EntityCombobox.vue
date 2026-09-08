<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { Check, ChevronsUpDown } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'

/** A pickable entity: a stable numeric value, a label to match/show, and an optional hint. */
export interface ComboboxOption {
  value: number
  label: string
  hint?: string
}

const props = defineProps<{
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  testId?: string
  /** Focus the input on mount so recommendations open immediately. */
  autoFocus?: boolean
}>()

const model = defineModel<number | null>({ required: true })
const open = ref(false)
const query = ref('')
const highlight = ref(0)
const inputRef = ref<{ $el?: HTMLElement } | HTMLElement | null>(null)
const listRef = ref<HTMLElement | null>(null)

const selected = computed(() => props.options.find((o) => o.value === model.value) ?? null)
const inputPlaceholder = computed(
  () => props.searchPlaceholder ?? props.placeholder ?? 'Type to filter…'
)

/** Filter only after the cashier edits the box; a selected label is display, not a query. */
const filtering = computed(() => {
  const q = query.value.trim()
  if (!q) return false
  if (selected.value && query.value === selected.value.label) return false
  return true
})

const filtered = computed(() => {
  if (!filtering.value) return props.options
  const q = query.value.trim().toLowerCase()
  return props.options.filter(
    (o) => o.label.toLowerCase().includes(q) || (o.hint != null && o.hint.toLowerCase().includes(q))
  )
})

watch(
  () => selected.value?.label ?? '',
  (label) => {
    if (!open.value) query.value = label
  },
  { immediate: true }
)

watch(filtered, (list) => {
  if (highlight.value >= list.length) highlight.value = Math.max(list.length - 1, 0)
})

// --- Handoff guards ----------------------------------------------------------
// The input is the popover *anchor*, not inside the layer. Reka treats typing
// and clicking it as outside-dismiss, which would close-and-reopen the list
// (animation loop, "element is not stable"). We prevent those dismisses and
// close ourselves on blur / Escape / pick.
// After a pick, skip restoring focus to this input so qty/cash can take over.

/** Skip restoring focus to this input on close after an option is chosen. */
let skipCloseAutoFocus = false

/** After a pick, keep the list closed until blur+focus or a new keystroke. */
let justPicked = false

let blurTimer: ReturnType<typeof setTimeout> | null = null

function inputEl(): HTMLInputElement | null {
  const r = inputRef.value
  if (!r) return null
  const node = r instanceof HTMLElement ? r : r.$el
  return node instanceof HTMLInputElement ? node : null
}

function cancelBlurTimer(): void {
  if (blurTimer == null) return
  clearTimeout(blurTimer)
  blurTimer = null
}

function syncQueryFromSelection(): void {
  query.value = selected.value?.label ?? ''
}

function choose(value: number): void {
  cancelBlurTimer()
  model.value = value
  query.value = props.options.find((o) => o.value === value)?.label ?? ''
  justPicked = true
  skipCloseAutoFocus = true
  open.value = false
  // Leave the box so a later click is a real refocus (and qty/cash can take over).
  void nextTick(() => inputEl()?.blur())
}

function onCloseAutoFocus(event: Event): void {
  if (!skipCloseAutoFocus) return
  event.preventDefault()
  skipCloseAutoFocus = false
}

function highlightSelected(): void {
  const idx = selected.value
    ? filtered.value.findIndex((o) => o.value === selected.value!.value)
    : 0
  highlight.value = idx >= 0 ? idx : 0
}

function showRecommendations(): void {
  if (!open.value) open.value = true
  highlightSelected()
}

/** Open the filter after a sibling picker closes (product after customer). */
function openFilter(): void {
  justPicked = false
  cancelBlurTimer()
  inputEl()?.focus()
  showRecommendations()
}

function onInputMouseDown(): void {
  // Clicking an already-focused input (Escape, or post-pick refocus) must
  // reopen the list — focus will not fire again.
  justPicked = false
  cancelBlurTimer()
  showRecommendations()
}

function onFocus(): void {
  cancelBlurTimer()
  if (justPicked) return
  showRecommendations()
  void nextTick(() => inputEl()?.select())
}

function onInput(value: string): void {
  justPicked = false
  cancelBlurTimer()
  query.value = value
  if (value.trim() === '') model.value = null
  showRecommendations()
}

function onBlur(): void {
  justPicked = false
  cancelBlurTimer()
  blurTimer = setTimeout(() => {
    blurTimer = null
    if (inputEl() === document.activeElement) return
    open.value = false
    syncQueryFromSelection()
  }, 150)
}

function scrollHighlight(): void {
  const el = listRef.value?.querySelector('[data-highlighted="true"]')
  el?.scrollIntoView({ block: 'nearest' })
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (!open.value) return
    event.preventDefault()
    open.value = false
    syncQueryFromSelection()
    return
  }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!open.value) {
      showRecommendations()
      return
    }
    const last = Math.max(filtered.value.length - 1, 0)
    highlight.value =
      event.key === 'ArrowDown'
        ? Math.min(highlight.value + 1, last)
        : Math.max(highlight.value - 1, 0)
    void nextTick(scrollHighlight)
    return
  }
  if (event.key === 'Enter') {
    const opt = filtered.value[highlight.value]
    if (!open.value || opt == null) return
    event.preventDefault()
    choose(opt.value)
  }
}

onMounted(() => {
  if (props.autoFocus) void nextTick(() => openFilter())
})

onUnmounted(() => {
  cancelBlurTimer()
})

defineExpose({
  /** Open after the current close cycle so a handoff target stays open. */
  focus: () => {
    window.setTimeout(() => openFilter(), 0)
  }
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverAnchor as-child>
      <div class="relative">
        <Input
          ref="inputRef"
          :model-value="query"
          :placeholder="inputPlaceholder"
          :data-testid="testId"
          role="combobox"
          autocomplete="off"
          aria-autocomplete="list"
          :aria-expanded="open"
          class="pr-8"
          @update:model-value="onInput($event as string)"
          @mousedown="onInputMouseDown"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onKeydown"
        />
        <ChevronsUpDown
          class="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 opacity-50"
        />
      </div>
    </PopoverAnchor>
    <PopoverContent
      class="w-[--reka-popover-anchor-width] p-1"
      align="start"
      :side-offset="4"
      @open-auto-focus.prevent
      @close-auto-focus="onCloseAutoFocus"
      @focus-outside.prevent
      @interact-outside.prevent
      @pointer-down-outside.prevent
    >
      <ul ref="listRef" role="listbox" class="max-h-[300px] overflow-y-auto">
        <li v-if="filtered.length === 0" class="px-2 py-1.5 text-sm text-muted-foreground">
          {{ emptyText ?? 'No match.' }}
        </li>
        <li
          v-for="(opt, index) in filtered"
          :key="opt.value"
          role="option"
          :aria-selected="opt.value === model"
          class="relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm select-none"
          :class="
            index === highlight
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent hover:text-accent-foreground'
          "
          :data-highlighted="index === highlight ? 'true' : undefined"
          @mousedown.prevent="choose(opt.value)"
        >
          <Check
            class="size-4 shrink-0"
            :class="opt.value === model ? 'opacity-100' : 'opacity-0'"
          />
          <span class="truncate">{{ opt.label }}</span>
          <span v-if="opt.hint" class="ml-auto pl-2 text-xs text-muted-foreground">
            {{ opt.hint }}
          </span>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
