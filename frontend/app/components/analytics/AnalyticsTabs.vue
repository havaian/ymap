<template>
  <div class="flex items-center gap-1 mb-6 overflow-x-auto">
    <NuxtLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-colors"
      :class="route.path === t.to
        ? 'bg-blue-600 text-white'
        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'"
    >
      {{ t.label }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/analytics', label: 'Общее' },
  { to: '/analytics/regions', label: 'Регионы' },
  { to: '/analytics/current', label: 'Текущая ситуация' },
  { to: '/analytics/problems', label: 'Проблемы' },
]
</script>
