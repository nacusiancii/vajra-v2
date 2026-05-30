<script setup lang="ts">
import { ref, computed } from 'vue'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'

const props = defineProps<{
  options: string[]
  placeholder?: string
  testId?: string
}>()

const model = defineModel<string>({ required: true })
const open = ref(false)

const filtered = computed(() => {
  if (!model.value) return props.options
  const lower = model.value.toLowerCase()
  return props.options.filter((o) => o.toLowerCase().includes(lower))
})

function onInput(value: string): void {
  model.value = value
  open.value = value.length > 0 && filtered.value.length > 0
}

function pick(value: string): void {
  model.value = value
  open.value = false
}

function onFocus(): void {
  if (filtered.value.length > 0) open.value = true
}

function onBlur(): void {
  // Small delay so click on option registers before popover closes
  setTimeout(() => {
    open.value = false
  }, 150)
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverAnchor as-child>
      <Input
        ref="inputRef"
        :model-value="model"
        :placeholder="placeholder ?? 'Type or pick...'"
        :data-testid="testId"
        autocomplete="off"
        @update:model-value="onInput($event as string)"
        @focus="onFocus"
        @blur="onBlur"
      />
    </PopoverAnchor>
    <PopoverContent
      class="w-[--reka-popover-anchor-width] p-1"
      align="start"
      :side-offset="4"
      @open-auto-focus.prevent
    >
      <ul class="max-h-48 overflow-y-auto">
        <li
          v-for="option in filtered"
          :key="option"
          class="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          :class="{ 'font-medium': option.toLowerCase() === (model ?? '').toLowerCase() }"
          @mousedown.prevent="pick(option)"
        >
          {{ option }}
        </li>
      </ul>
    </PopoverContent>
  </Popover>
</template>
