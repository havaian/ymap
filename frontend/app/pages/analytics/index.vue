<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6 py-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-600" />
    </div>

    <p v-else-if="!ov" class="text-center text-sm text-slate-400 py-24">Не удалось загрузить аналитику</p>

    <template v-else>
      <!-- Big KPI cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          v-for="k in bigKpis"
          :key="k.label"
          class="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex items-start justify-between"
        >
          <div>
            <p class="text-sm text-slate-400">{{ k.label }}</p>
            <p class="mt-2 text-4xl font-black text-slate-800 dark:text-white">{{ k.value }}</p>
          </div>
          <div class="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-300">
            <component :is="k.icon" :size="20" />
          </div>
        </div>
      </div>

      <!-- Small KPI cards -->
      <div class="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="k in smallKpis"
          :key="k.label"
          class="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 p-5 shadow-sm"
        >
          <div class="flex items-center justify-between">
            <p class="text-xs text-slate-400">{{ k.label }}</p>
            <div class="w-8 h-8 rounded-full flex items-center justify-center" :class="k.iconBg">
              <component :is="k.icon" :size="15" :class="k.iconColor" />
            </div>
          </div>
          <p class="mt-3 text-3xl font-black text-slate-800 dark:text-white">{{ k.value }}</p>
        </div>
      </div>

      <!-- Overall satisfaction (donut) -->
      <div class="mt-4 bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 class="text-xl font-black text-slate-800 dark:text-white">Общее состояние</h3>
        <p class="text-sm text-slate-400">Удовлетворенность пользователей</p>

        <div class="mt-6">
          <SatisfactionDonut :percent="satisfaction" />
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2, Building2, Map as MapIcon, ClipboardCheck, Smile, CheckCircle2, AlertTriangle } from 'lucide-vue-next'

definePageMeta({
  layout: 'app',
  // Этап 10: аналитика публичная (ТЗ раздел 3.4) - гейт логина снят.
  pageTitle: 'Общее',
  pageSubtitle: 'Сводная статистика по системе',
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
const satisfaction = computed(() => ov.value?.tasks.completionRate ?? 0)

const bigKpis = computed(() => {
  const o = ov.value
  if (!o) return []
  return [
    { label: 'Всего объектов', value: fmt(o.objects.total), icon: Building2 },
    { label: 'Количество регионов', value: fmt(regionCount.value), icon: MapIcon },
  ]
})

const smallKpis = computed(() => {
  const o = ov.value
  if (!o) return []
  const problems = Math.max(o.tasks.total - o.tasks.completed, 0)
  return [
    { label: 'Всего проверок', value: fmt(o.tasks.total), icon: ClipboardCheck, iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-500' },
    { label: 'Довольны', value: `${satisfaction.value}%`, icon: Smile, iconBg: 'bg-violet-50 dark:bg-violet-900/20', iconColor: 'text-violet-500' },
    { label: 'Выполнено', value: fmt(o.tasks.completed), icon: CheckCircle2, iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-500' },
    { label: 'Проблемы', value: fmt(problems), icon: AlertTriangle, iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-500' },
  ]
})
</script>
