<template>
  <section class="mx-auto max-w-3xl px-4 sm:px-6 py-24">
    <h1 class="text-3xl font-black tracking-tight">Статья</h1>
    <p class="mt-2 text-slate-500 dark:text-slate-400 break-all">/{{ slug }}</p>
    <p class="mt-4 text-slate-500 dark:text-slate-400">
      {{ $t('common.inDevelopment') }} · Этап 7
    </p>
  </section>
</template>

<script setup lang="ts">
const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))
useSeoMeta({ title: () => `Статья - ${slug.value}` })
</script>
