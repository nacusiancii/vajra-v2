<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { useCustomersQuery } from '@/queries/customers'
import { journalNameMatchesCustomer } from '@domain/journal'

/**
 * Free-text party plus optional Customer Master id.
 * `customerId` is set only when the cashier explicitly activates a suggestion
 * (click or keyboard-confirm that item). Typed Enter, blur, or submit without
 * that activate leaves it null even if the string equals a Customer name.
 */
export interface JournalNameValue {
  name: string
  customerId: number | null
}

interface JournalNameSuggestion {
  id: number
  name: string
  place?: string
}

const props = defineProps<{
  id?: string
  placeholder?: string
  testId?: string
  autofocus?: boolean
}>()

const model = defineModel<JournalNameValue>({ required: true })

const { data: customers } = useCustomersQuery()
const open = ref(false)
const focused = ref(false)
/** After an explicit pick, keep the list closed until the next type/focus. */
const suppressOpen = ref(false)
const highlighted = ref(-1)
const listId = useId()

const suggestions = computed<JournalNameSuggestion[]>(() =>
  (customers.value ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    place: c.placeName.trim() ? c.placeName : undefined
  }))
)

const filtered = computed(() => {
  const q = model.value.name.trim().toLowerCase()
  if (!q) return suggestions.value
  return suggestions.value.filter((s) => s.name.toLowerCase().includes(q))
})

const optionTestId = computed(() => (props.testId ? `${props.testId}-option` : undefined))

const activeOptionId = computed(() => {
  const item = filtered.value[highlighted.value]
  return item ? optionDomId(item.id) : undefined
})

function optionDomId(id: number): string {
  return `${listId}-opt-${id}`
}

function showListIfAny(): void {
  if (suppressOpen.value) return
  open.value = filtered.value.length > 0
}

function onInput(raw: string): void {
  suppressOpen.value = false
  const current = model.value
  let customerId = current.customerId
  if (customerId != null) {
    const selected = (customers.value ?? []).find((c) => c.id === customerId)
    if (selected && !journalNameMatchesCustomer(raw, selected.name)) {
      customerId = null
    }
  }
  model.value = { name: raw, customerId }
  highlighted.value = -1
  showListIfAny()
}

function activate(suggestion: JournalNameSuggestion): void {
  model.value = { name: suggestion.name, customerId: suggestion.id }
  suppressOpen.value = true
  open.value = false
  highlighted.value = -1
}

function onFocus(): void {
  focused.value = true
  showListIfAny()
}

function onBlur(): void {
  focused.value = false
  suppressOpen.value = false
  open.value = false
  highlighted.value = -1
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    if (!open.value) return
    event.preventDefault()
    open.value = false
    highlighted.value = -1
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    if (filtered.value.length === 0) return
    event.preventDefault()
    suppressOpen.value = false
    open.value = true
    if (event.key === 'ArrowDown') {
      highlighted.value = (highlighted.value + 1) % filtered.value.length
    } else if (highlighted.value <= 0) {
      highlighted.value = filtered.value.length - 1
    } else {
      highlighted.value -= 1
    }
    return
  }

  if (event.key !== 'Enter') return

  const item = highlighted.value >= 0 ? filtered.value[highlighted.value] : undefined
  if (item) {
    event.preventDefault()
    activate(item)
    return
  }
  if (open.value) {
    event.preventDefault()
    open.value = false
  }
}

watch(suggestions, () => {
  if (!focused.value) return
  showListIfAny()
})
</script>

<template>
  <Popover v-model:open="open">
    <PopoverAnchor as-child>
      <Input
        :id="id"
        :model-value="model.name"
        :placeholder="placeholder ?? 'Party'"
        :data-testid="testId"
        :autofocus="autofocus"
        role="combobox"
        :aria-expanded="open"
        aria-autocomplete="list"
        :aria-controls="listId"
        :aria-activedescendant="activeOptionId"
        autocomplete="off"
        @update:model-value="onInput(String($event))"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
    </PopoverAnchor>
    <PopoverContent
      class="w-[--reka-popover-anchor-width] p-1"
      align="start"
      :side-offset="4"
      @open-auto-focus.prevent
    >
      <ul :id="listId" role="listbox" class="max-h-48 overflow-y-auto">
        <li
          v-for="(suggestion, index) in filtered"
          :id="optionDomId(suggestion.id)"
          :key="suggestion.id"
          role="option"
          :aria-selected="model.customerId === suggestion.id"
          class="flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm"
          :class="
            index === highlighted
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent hover:text-accent-foreground'
          "
          :data-testid="optionTestId"
          @mousedown.prevent="activate(suggestion)"
          @mouseenter="highlighted = index"
        >
          <span class="truncate">{{ suggestion.name }}</span>
          <span v-if="suggestion.place" class="ml-auto pl-2 text-xs text-muted-foreground">
            {{ suggestion.place }}
          </span>
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
