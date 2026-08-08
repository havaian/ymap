<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <template v-else>
      <!-- Most frequent problems (real - /issues byCategory) -->
      <section class="panel p-6">
        <SectionHead
          title="Самые частые проблемы"
          eyebrow="По категориям"
          note="Счёт обращений, а не объектов: одно здание может стоять за несколькими записями."
        />
        <div v-if="byCategory.length" class="mt-6 space-y-3">
          <div v-for="c in byCategory" :key="c._id" class="flex items-center gap-4">
            <span class="w-40 shrink-0 truncate text-body text-ink dark:text-paper">
              {{ categoryLabel(c._id) }}
            </span>
            <div class="span-track flex-1">
              <div
                class="span-lower"
                :style="{ width: barWidth(c.count) + '%', backgroundColor: barColor(c.count) }"
              />
            </div>
            <span class="w-16 shrink-0 text-right font-mono text-body text-ink-muted dark:text-ink-faint">
              {{ c.count }} шт
            </span>
          </div>
        </div>
        <p v-else class="mt-6 text-body text-ink-muted dark:text-ink-faint">Нет данных</p>
      </section>

      <!-- Completed vs problems donut (real - /overview completionRate) -->
      <section class="panel mt-4 p-6">
        <SectionHead
          title="Распределение состояний"
          eyebrow="Проверки"
          note="Соотношение закрытых и оставшихся заданий верификации."
        />
        <div class="mt-6">
          <SatisfactionDonut
            :percent="completion"
            label-a="Выполнено"
            label-b="Проблемы"
            center-label="Выполнено"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

// REWORKED to the register design system. The bar was blue above half and yellow
// below, which encoded nothing: a category is not better for being rarer. The
// ramp runs on the share of the largest category instead, so the longest bar is
// the most reported and reads as the most deficient.
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
const scale = useScale()
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
const barColor = (n: number) => scale.deficiency(n / maxCount.value)
</script>
