<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!ov" class="py-24 text-center text-body text-ink-muted dark:text-ink-faint">
      Не удалось загрузить аналитику
    </p>

    <template v-else>
      <!-- This section is fed by what people submit, and almost nothing has been
           submitted yet. Zeros in every card look like a broken product; saying
           plainly that the section has not been populated does not. The registry
           side is a different circuit and is full. -->
      <NoteBlock v-if="civicEmpty" class="mb-4" title="Раздел ещё не наполнен">
        Здесь показываются обращения и проверки, которые оставляют пользователи. Пока их нет.
        Данные по объектам инфраструктуры лежат в разделе «Обсерватория» и не зависят от этого счётчика.
        <NuxtLink
          to="/analytics/data-quality"
          class="mt-2 block font-semibold text-prussian-600 dark:text-prussian-200"
        >
          Перейти к данным реестров
        </NuxtLink>
      </NoteBlock>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatPanel
          v-for="k in bigKpis"
          :key="k.label"
          :label="k.label"
          :value="k.value"
          :denominator="k.sub"
        />
      </div>

      <div class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatPanel v-for="k in smallKpis" :key="k.label" :label="k.label" :value="k.value" />
      </div>

      <section class="panel mt-4 p-6">
        <SectionHead
          title="Общее состояние"
          eyebrow="Проверки"
          note="Доля заданий, закрытых как выполненные, от всех заданий с хотя бы одним ответом."
        />
        <div class="mt-6">
          <SatisfactionDonut :percent="satisfaction" />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

// REWORKED to the register design system. Eight cards each carried an icon in a
// coloured circle - blue, violet, emerald, red - and the colours meant nothing:
// they were assigned per card, not per value. Figures go through StatPanel now,
// which puts the denominator next to the number instead of dropping it.
definePageMeta({
  layout: 'app',
  // Этап 10: аналитика публичная (ТЗ раздел 3.4) - гейт логина снят.
  pageTitle: 'Сводка',
  pageSubtitle: 'Обращения и проверки от пользователей',
})
useSeoMeta({ title: 'Аналитика - Y.Map' })

interface Overview {
  objects: { total: number }
  issues: { total: number; open: number; inProgress: number; resolved: number; totalVotes: number }
  tasks: { total: number; completed: number; completionRate: number | null }
}

const { $api } = useNuxtApp()
const ov = ref<Overview | null>(null)
const regionCount = ref(0)
const loading = ref(true)

onMounted(async () => {
  try {
    const [overview, regions] = await Promise.all([
      $api<{ success: boolean; data: Overview }>('/analytics/overview'),
      $api<{ success: boolean; data: unknown[] }>('/regions').catch(() => ({ success: false, data: [] as unknown[] })),
    ])
    ov.value = overview.data
    regionCount.value = Array.isArray(regions.data) ? regions.data.length : 0
  } catch {
    ov.value = null
  } finally {
    loading.value = false
  }
})

const fmt = (n: number) => n.toLocaleString('ru-RU')

// Both counters come from user activity. If neither has moved, the section has no
// content yet rather than a value of zero to report.
const civicEmpty = computed(() => {
  const o = ov.value
  return !!o && o.issues.total === 0 && o.tasks.total === 0
})
const satisfaction = computed(() => ov.value?.tasks.completionRate ?? 0)

const bigKpis = computed(() => {
  const o = ov.value
  if (!o) return []
  return [
    { label: 'Всего объектов', value: fmt(o.objects.total), sub: 'Записей реестров загружено в базу' },
    { label: 'Регионов в покрытии', value: fmt(regionCount.value), sub: 'С загруженной границей' },
  ]
})

const smallKpis = computed(() => {
  const o = ov.value
  if (!o) return []
  const problems = Math.max(o.tasks.total - o.tasks.completed, 0)
  return [
    { label: 'Всего проверок', value: fmt(o.tasks.total) },
    { label: 'Довольны', value: `${satisfaction.value} %` },
    { label: 'Выполнено', value: fmt(o.tasks.completed) },
    { label: 'Проблемы', value: fmt(problems) },
  ]
})
</script>
