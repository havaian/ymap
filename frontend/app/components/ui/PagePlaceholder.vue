<template>
  <section class="mx-auto max-w-7xl px-4 sm:px-6 py-24 text-center">
    <h1 class="font-display text-h1 font-semibold tracking-tight">{{ title }}</h1>
    <p class="mt-4 text-body text-ink-muted dark:text-ink-faint">
      {{ $t('common.inDevelopment') }} · {{ phase }}
    </p>
  </section>
</template>

<script setup lang="ts">
// Neutral placeholder for scaffolded routes. No fabricated content - real screens land
// in their respective phases.
defineProps<{ title: string; phase: string }>()
</script>
