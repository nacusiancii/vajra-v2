<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
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

function choose(value: number): void {
  model.value = value
  open.value = false
}

onMounted(() => {
  if (props.autoFocus) void nextTick(() => (open.value = true))
})

defineExpose({
  focus: () => {
    open.value = true
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
    <PopoverContent class="w-[--reka-popover-trigger-width] p-0" align="start">
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
