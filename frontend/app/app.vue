<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// The initial theme class is set pre-paint by the inline script in nuxt.config.
// After hydration we keep the store in sync and listen for OS theme changes.
const ui = useUiStore()
onMounted(() => ui.initTheme())
</script>
