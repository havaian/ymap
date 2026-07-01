<template>
  <button
    type="button"
    :aria-label="isDark ? 'Светлая тема' : 'Тёмная тема'"
    class="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
    @click="toggle"
  >
    <ClientOnly>
      <SunIcon v-if="isDark" :size="18" />
      <MoonIcon v-else :size="18" />
      <template #fallback><MoonIcon :size="18" /></template>
    </ClientOnly>
  </button>
</template>

<script setup lang="ts">
import { Sun as SunIcon, Moon as MoonIcon } from 'lucide-vue-next'

const { theme, toggle } = useTheme()

const isDark = computed(() => {
  if (theme.value === 'dark') return true
  if (theme.value === 'light') return false
  if (import.meta.client) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return false
})
</script>
