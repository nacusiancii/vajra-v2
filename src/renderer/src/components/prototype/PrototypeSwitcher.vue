<script setup lang="ts">
/**
 * PROTOTYPE ONLY — floating variant switcher (UI.md).
 * Hidden in production builds so a stray merge cannot ship the bar.
 */
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import { Button } from '@/components/ui/button'

export interface PrototypeVariantMeta {
  key: string
  name: string
}

const props = defineProps<{
  variants: PrototypeVariantMeta[]
}>()

const route = useRoute()
const router = useRouter()

const isDev = import.meta.env.DEV

const currentKey = computed(() => {
  const q = route.query.variant
  const raw = Array.isArray(q) ? q[0] : q
  if (typeof raw === 'string' && props.variants.some((v) => v.key === raw)) return raw
  return props.variants[0]?.key ?? 'A'
})

const currentMeta = computed(
  () => props.variants.find((v) => v.key === currentKey.value) ?? props.variants[0]
)

function setVariant(key: string): void {
  void router.replace({ query: { ...route.query, variant: key } })
}

function cycle(delta: number): void {
  const keys = props.variants.map((v) => v.key)
  if (keys.length === 0) return
  const idx = keys.indexOf(currentKey.value)
  const next = keys[(idx + delta + keys.length) % keys.length]
  setVariant(next)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const t = e.target as HTMLElement | null
  if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
  e.preventDefault()
  cycle(e.key === 'ArrowLeft' ? -1 : 1)
}

onMounted(() => {
  if (isDev) window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    v-if="isDev"
    class="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4"
    data-testid="prototype-switcher"
  >
    <div
      class="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-amber-500 bg-zinc-950 px-2 py-1.5 text-zinc-50 shadow-xl"
    >
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="size-8 rounded-full p-0 text-zinc-50 hover:bg-zinc-800 hover:text-white"
        aria-label="Previous variant"
        data-testid="prototype-switcher-prev"
        @click="cycle(-1)"
      >
        <ChevronLeft class="size-4" />
      </Button>
      <span
        class="min-w-[12rem] text-center text-xs font-semibold tracking-wide tabular-nums"
        data-testid="prototype-switcher-label"
      >
        {{ currentMeta?.key }} — {{ currentMeta?.name }}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        class="size-8 rounded-full p-0 text-zinc-50 hover:bg-zinc-800 hover:text-white"
        aria-label="Next variant"
        data-testid="prototype-switcher-next"
        @click="cycle(1)"
      >
        <ChevronRight class="size-4" />
      </Button>
    </div>
  </div>
</template>
