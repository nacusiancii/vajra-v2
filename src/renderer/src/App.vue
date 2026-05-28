<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
</script>

<template>
  <div class="flex min-h-screen flex-col bg-background text-foreground">
    <header
      class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
    >
      <div class="mx-auto flex h-14 max-w-6xl items-center px-6">
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
  </div>
</template>
