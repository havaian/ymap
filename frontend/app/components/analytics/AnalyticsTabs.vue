<template>
  <div class="mb-6">
    <!-- Which circuit this page belongs to, and what feeds it. The two sets never
         appear together: a row of nine tabs mixing registry pages with civic ones
         reads as one product where there are two, at very different stages of fill. -->
    <div v-if="section" class="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span class="eyebrow">{{ section.title }}</span>
      <span class="text-label text-ink-faint">{{ section.hint }}</span>
    </div>

    <!-- Rule-anchored tabs rather than floating pills: the active one sits on the
         line, the rest hang off it. Reads as a register index, not a toolbar. -->
    <div class="flex items-stretch gap-1 overflow-x-auto border-b border-rule dark:border-night-rule">
      <NuxtLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-body transition-colors"
        :class="route.path === t.to
          ? 'border-prussian-600 font-semibold text-prussian-600 dark:border-prussian-200 dark:text-prussian-200'
          : 'border-transparent text-ink-muted hover:text-ink dark:text-ink-faint dark:hover:text-paper'"
      >
        {{ t.label }}
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

// Registry pages first because that is where the data is. The civic set is listed
// second and is reached from the sidebar or from its own pages, never as a
// continuation of the registry row.
const SECTIONS = [
  {
    key: 'observatory',
    title: 'Обсерватория',
    hint: 'Реестры объектов и модели на них',
    tabs: [
      { to: '/analytics/capacity', label: 'Мощность' },
      { to: '/analytics/wear', label: 'Износ' },
      { to: '/analytics/deprivation', label: 'Депривация' },
      { to: '/analytics/verification', label: 'Верификация' },
      { to: '/analytics/data-quality', label: 'Качество данных' },
    ],
  },
  {
    key: 'civic',
    title: 'Обращения',
    hint: 'Обращения и проверки от пользователей',
    // The three collapsed pages stay listed here so that landing on one directly
    // still shows a section and a way back, rather than a page with no context.
    tabs: [
      { to: '/analytics', label: 'Сводка' },
      { to: '/analytics/regions', label: 'Регионы' },
      { to: '/analytics/current', label: 'Текущая ситуация' },
      { to: '/analytics/problems', label: 'Проблемы' },
    ],
  },
]

// Exact path match, so /analytics does not claim every page beneath it.
const section = computed(() => SECTIONS.find((s) => s.tabs.some((t) => t.to === route.path)) ?? null)
const tabs = computed(() => section.value?.tabs ?? [])
</script>
