<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6 py-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-600" />
    </div>

    <template v-else>
      <!-- Most frequent problems (real - /issues byCategory) -->
      <div class="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 class="text-xl font-black text-slate-800 dark:text-white">Самые частые проблемы</h3>
        <p class="text-sm text-slate-400">По количеству обращений</p>
        <div v-if="byCategory.length" class="mt-6 space-y-3">
          <div v-for="c in byCategory" :key="c._id" class="flex items-center gap-4">
            <span class="w-40 shrink-0 text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">{{ categoryLabel(c._id) }}</span>
            <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: barWidth(c.count) + '%', backgroundColor: barColor(c.count) }" />
            </div>
            <span class="w-12 shrink-0 text-right text-sm font-black text-slate-500 dark:text-slate-300">{{ c.count }} шт</span>
          </div>
        </div>
        <p v-else class="mt-6 text-sm text-slate-400">Нет данных</p>
      </div>

      <!-- Completed vs problems donut (real - /overview completionRate) -->
      <div class="mt-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 class="text-xl font-black text-slate-800 dark:text-white">Распределение состояний</h3>
        <p class="text-sm text-slate-400">Соотношение выполненных и проблемных</p>
        <div class="mt-6">
          <SatisfactionDonut
            :percent="completion"
            label-a="Выполнено"
            label-b="Проблемы"
            center-label="Выполнено"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: 'app',
  // Этап 10: аналитика публичная (ТЗ раздел 3.4) - гейт логина снят.
  pageTitle: 'Проблемы',
  pageSubtitle: 'Обзор выявленных проблем',
})
useSeoMeta({ title: 'Аналитика · Проблемы - Y.Map' })

interface CategoryCount {
  _id: string
  count: number
  votes: number
}

const { $api } = useNuxtApp()
const byCategory = ref<CategoryCount[]>([])
const completion = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    const [issues, overview] = await Promise.all([
      $api<{ success: boolean; data: { byCategory: CategoryCount[] } }>('/analytics/issues'),
      $api<{ success: boolean; data: { tasks: { completionRate: number | null } } }>('/analytics/overview'),
    ])
    byCategory.value = issues.data.byCategory ?? []
    completion.value = overview.data.tasks.completionRate ?? 0
  } catch {
    byCategory.value = []
  } finally {
    loading.value = false
  }
})

const CATEGORY_LABEL: Record<string, string> = {
  Roads: 'Дороги',
  'Water & Sewage': 'Вода и канализация',
  Electricity: 'Электричество',
  'Schools & Kindergartens': 'Школы и детсады',
  'Hospitals & Clinics': 'Больницы и клиники',
  'Waste Management': 'Вывоз мусора',
  Other: 'Прочее',
}
const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? c

const maxCount = computed(() => Math.max(1, ...byCategory.value.map((c) => c.count)))
const barWidth = (n: number) => Math.round((n / maxCount.value) * 100)
const barColor = (n: number) => (barWidth(n) >= 50 ? '#3b82f6' : '#eab308')
</script>
