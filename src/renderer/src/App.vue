<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useToastState } from '@/lib/toast'

const route = useRoute()
const router = useRouter()
const isHome = computed(() => route.path === '/')
const toast = useToastState()

function goBack(): void {
  if (window.history.length > 1) router.back()
  else void router.push('/')
}
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <header
      class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
    >
      <div class="mx-auto flex h-14 max-w-6xl items-center gap-3 px-6">
        <Button v-if="!isHome" variant="ghost" size="sm" data-testid="back-button" @click="goBack">
          <ArrowLeft class="size-4" />
          Back
        </Button>
        <RouterLink
          to="/"
          class="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
        >
          Vajra
        </RouterLink>
      </div>
    </header>
    <main class="flex-1">
      <RouterView />
    </main>

    <!-- Global toast (EOD export success/failure and similar feedback) -->
    <div
      v-if="toast.visible"
      class="fixed bottom-6 right-6 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg"
      :class="
        toast.kind === 'error'
          ? 'border-destructive/40 bg-destructive text-destructive-foreground'
          : 'border-border bg-foreground text-background'
      "
      role="status"
      data-testid="toast"
      :data-toast-kind="toast.kind"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
