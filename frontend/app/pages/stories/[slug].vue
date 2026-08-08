<template>
  <section class="mx-auto max-w-3xl px-4 py-24 sm:px-6">
    <p class="eyebrow">Истории людей</p>
    <h1 class="mt-3 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">История</h1>
    <p class="mt-2 break-all font-mono text-note text-ink-faint">/{{ slug }}</p>
    <p class="mt-4 text-body text-ink-muted dark:text-ink-faint">
      {{ $t('common.inDevelopment') }} · Этап 7
    </p>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
useSeoMeta({ title: () => `История - ${slug.value}` })
</script>
