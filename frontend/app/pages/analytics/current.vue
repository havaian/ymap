<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6 py-6">
    <AnalyticsTabs />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black text-slate-800 dark:text-white">Топ 5 - Лучшие</h3>
          <span class="text-xs text-slate-400">по результатам проверок</span>
        </div>
        <div class="mt-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400">
          Появится после ввода скоринга объектов
        </div>
      </div>

      <div class="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-black text-slate-800 dark:text-white">Требующие внимания</h3>
          <span class="text-xs text-slate-400">ниже среднего</span>
        </div>
        <div class="mt-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400">
          Появится после ввода скоринга объектов
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// Per-object verification scoring is an open question (ОВ №5); no endpoint returns a
// per-object score yet. The design (objects ranked by %) is kept as structure with an
// empty state rather than substituting region data.
definePageMeta({
  layout: 'app',
  // Этап 10: аналитика публичная (ТЗ раздел 3.4) - гейт логина снят.
  pageTitle: 'Текущая ситуация',
  pageSubtitle: 'Лучшие и проблемные объекты',
})
useSeoMeta({ title: 'Аналитика · Текущая ситуация - Y.Map' })
</script>
