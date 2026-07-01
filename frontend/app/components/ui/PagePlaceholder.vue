<template>
  <section class="mx-auto max-w-7xl px-4 sm:px-6 py-24 text-center">
    <h1 class="text-3xl sm:text-4xl font-black tracking-tight">{{ title }}</h1>
    <p class="mt-4 text-slate-500 dark:text-slate-400">
      {{ $t('common.inDevelopment') }} · {{ phase }}
    </p>
  </section>
</template>

<script setup lang="ts">
// Neutral placeholder for scaffolded routes. No fabricated content - real screens land
// in their respective phases.
defineProps<{ title: string; phase: string }>()
</script>
