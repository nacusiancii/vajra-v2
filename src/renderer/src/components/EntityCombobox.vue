<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Check, ChevronsUpDown } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'

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
  /** Open the filter on mount so the cashier lands straight in the search box. */
  autoFocus?: boolean
}>()

const model = defineModel<number | null>({ required: true })
const open = ref(false)
const selected = computed(() => props.options.find((o) => o.value === model.value) ?? null)

// --- Handoff guards ----------------------------------------------------------
// Selecting an option (or programmatically opening right after another popover
// closes) races reka's close-auto-focus and outside-dismiss handlers — often
// after the exit animation. Without these guards the next picker opens then
// snaps shut.

/** Skip restoring focus to this trigger on close after an option is chosen. */
let skipCloseAutoFocus = false

/** Briefly ignore outside dismiss after a programmatic open. */
let ignoreOutsideDismiss = false
let ignoreOutsideTimer: ReturnType<typeof setTimeout> | null = null

/** Cover Presence exit animation (~150ms) plus focus-outside's double nextTick. */
const IGNORE_OUTSIDE_MS = 200

function choose(value: number): void {
  model.value = value
  skipCloseAutoFocus = true
  open.value = false
}

function onCloseAutoFocus(event: Event): void {
  if (!skipCloseAutoFocus) return
  event.preventDefault()
  skipCloseAutoFocus = false
}

function armIgnoreOutsideDismiss(): void {
  ignoreOutsideDismiss = true
  if (ignoreOutsideTimer != null) clearTimeout(ignoreOutsideTimer)
  ignoreOutsideTimer = setTimeout(() => {
    ignoreOutsideDismiss = false
    ignoreOutsideTimer = null
  }, IGNORE_OUTSIDE_MS)
}

function onOutsideDismiss(event: Event): void {
  if (ignoreOutsideDismiss) event.preventDefault()
}

/** Open the filter, protected against a sibling popover's late focus restore. */
function openFilter(): void {
  armIgnoreOutsideDismiss()
  open.value = true
}

onMounted(() => {
  if (props.autoFocus) void nextTick(() => openFilter())
})

onUnmounted(() => {
  if (ignoreOutsideTimer != null) clearTimeout(ignoreOutsideTimer)
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
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        class="w-full justify-between font-normal"
        :data-testid="testId"
      >
        <span class="truncate" :class="{ 'text-muted-foreground': !selected }">
          {{ selected ? selected.label : (placeholder ?? 'Select…') }}
        </span>
        <ChevronsUpDown class="ml-2 size-4 shrink-0 opacity-50" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      class="w-[--reka-popover-trigger-width] p-0"
      align="start"
      @close-auto-focus="onCloseAutoFocus"
      @focus-outside="onOutsideDismiss"
      @interact-outside="onOutsideDismiss"
      @pointer-down-outside="onOutsideDismiss"
    >
      <Command>
        <CommandInput :placeholder="searchPlaceholder ?? 'Type to filter…'" />
        <CommandList>
          <CommandEmpty>{{ emptyText ?? 'No match.' }}</CommandEmpty>
          <CommandGroup>
            <CommandItem
              v-for="opt in options"
              :key="opt.value"
              :value="String(opt.value)"
              @select="() => choose(opt.value)"
            >
              <Check
                class="size-4 shrink-0"
                :class="opt.value === model ? 'opacity-100' : 'opacity-0'"
              />
              <span class="truncate">{{ opt.label }}</span>
              <span v-if="opt.hint" class="ml-auto pl-2 text-xs text-muted-foreground">
                {{ opt.hint }}
              </span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
