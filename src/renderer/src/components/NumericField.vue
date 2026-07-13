<script setup lang="ts">
/**
 * Focus / string-buffer / blur-commit number input.
 *
 * Unfocused: shows the canonical domain value (paise→rupees, qty, etc.).
 * Focused: owns a local string buffer (editText) so intermediate strings like
 * "", "3.", "0.7" do not fight a number rebind. Select-all on focus so
 * replace-all is the default counter habit.
 * Typing: only editText mutates the visible value; when the buffer parses as a
 * complete number (or empty), also soft-emit the domain value so cart totals
 * stay live — without rebinding the string from the parent.
 * Blur / Enter: hard-commit (quantize / normalize); invalid reverts to last good.
 *
 * Naming: the buffer is editText — never "draft" (reserved domain term).
 */
import { computed, nextTick, ref } from 'vue'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'
import { formatDomainValue, parseDomainValue, type NumericFieldMode } from '@/lib/numeric-field'

const props = withDefaults(
  defineProps<{
    modelValue: number | null
    mode: NumericFieldMode
    /** When true (default), empty on blur commits null. When false, empty reverts. */
    allowEmpty?: boolean
    disabled?: boolean
    placeholder?: string
    class?: HTMLAttributes['class']
    id?: string
    /** data-testid for Playwright / smoke. */
    testId?: string
  }>(),
  {
    allowEmpty: true,
    disabled: false
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const inputEl = ref<HTMLInputElement | null>(null)
const focused = ref(false)
/** Local string while focused — not domain state. */
const editText = ref('')

const displayText = computed(() => formatDomainValue(props.mode, props.modelValue))

const shownValue = computed(() =>
  focused.value && !props.disabled ? editText.value : displayText.value
)

function emitIfParsed(): void {
  const parsed = parseDomainValue(props.mode, editText.value)
  if (parsed.kind === 'value') {
    if (props.modelValue !== parsed.value) {
      emit('update:modelValue', parsed.value)
    }
    return
  }
  if (parsed.kind === 'empty' && props.allowEmpty) {
    if (props.modelValue !== null) {
      emit('update:modelValue', null)
    }
  }
  // invalid intermediate (e.g. "-", "."): keep last good modelValue
}

function onFocus(event: FocusEvent): void {
  if (props.disabled) return
  focused.value = true
  editText.value = displayText.value
  const el = event.target as HTMLInputElement
  void nextTick(() => {
    el.select()
  })
}

function onInput(event: Event): void {
  if (props.disabled) return
  editText.value = (event.target as HTMLInputElement).value
  emitIfParsed()
}

function commitFromEditText(): void {
  const parsed = parseDomainValue(props.mode, editText.value)

  if (parsed.kind === 'invalid') {
    editText.value = displayText.value
    return
  }

  if (parsed.kind === 'empty') {
    if (!props.allowEmpty) {
      editText.value = displayText.value
      return
    }
    if (props.modelValue !== null) {
      emit('update:modelValue', null)
    }
    editText.value = ''
    return
  }

  // parsed.kind === 'value'
  if (props.modelValue !== parsed.value) {
    emit('update:modelValue', parsed.value)
  }
  // Normalize display to quantized canonical form after hard commit.
  editText.value = formatDomainValue(props.mode, parsed.value)
}

function onBlur(): void {
  if (props.disabled) {
    focused.value = false
    return
  }
  commitFromEditText()
  focused.value = false
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' || props.disabled) return
  event.preventDefault()
  commitFromEditText()
  inputEl.value?.blur()
}

function focus(): void {
  inputEl.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <input
    :id="id"
    ref="inputEl"
    type="text"
    inputmode="decimal"
    :value="shownValue"
    :disabled="disabled"
    :placeholder="placeholder"
    :data-testid="testId"
    :class="
      cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        'tabular-nums',
        props.class
      )
    "
    @focus="onFocus"
    @input="onInput"
    @blur="onBlur"
    @keydown="onKeydown"
  />
</template>
