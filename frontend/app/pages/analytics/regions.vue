<template>
  <div class="mx-auto max-w-6xl px-4 sm:px-6 py-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-600" />
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- By regions (real - /regions/summary) -->
      <div class="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 class="text-xl font-black text-slate-800 dark:text-white">Удовлетворенность по регионам</h3>
        <p class="text-sm text-slate-400">Распределение по {{ regions.length }} регионам</p>
        <div class="mt-6 space-y-4">
          <div v-for="r in sortedRegions" :key="r.code">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="font-bold text-sm text-slate-700 dark:text-slate-200 truncate">{{ regionName(r) }}</p>
                <p class="text-[11px] text-slate-400">{{ r.issueCount }} обращений · {{ r.objectCount }} объектов</p>
              </div>
              <span class="text-lg font-black text-slate-800 dark:text-white shrink-0">{{ r.resolutionRate ?? 0 }}%</span>
            </div>
            <div class="mt-2 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full" :style="{ width: (r.resolutionRate ?? 0) + '%', backgroundColor: barColor(r.resolutionRate ?? 0) }" />
            </div>
          </div>
        </div>
      </div>

      <!-- By organs (blocked - Agency Dashboard) -->
      <div class="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 class="text-xl font-black text-slate-800 dark:text-white">Удовлетворенность по органам</h3>
        <p class="text-sm text-slate-400">Распределение по органам</p>
        <div class="mt-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400">
          Данные по органам появятся после подключения Agency Dashboard
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

definePageMeta({
  layout: 'app',
  // Этап 10: аналитика публичная (ТЗ раздел 3.4) - гейт логина снят.
  pageTitle: 'Регионы',
  pageSubtitle: 'Анализ по территориальному признаку',
})
useSeoMeta({ title: 'Аналитика · Регионы - Y.Map' })

interface RegionSummary {
  code: number
  name: { ru?: string; uz?: string; en?: string } | string
  areaKm2?: number
  issueCount: number
  resolvedCount: number
  resolutionRate: number | null
  objectCount: number
}

const { $api } = useNuxtApp()
const regions = ref<RegionSummary[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: RegionSummary[] }>('/analytics/regions/summary')
    regions.value = res.data
  } catch {
    regions.value = []
  } finally {
    loading.value = false
  }
})

const sortedRegions = computed(() =>
  [...regions.value].sort((a, b) => (b.resolutionRate ?? 0) - (a.resolutionRate ?? 0)),
)

const regionName = (r: RegionSummary) => {
  const n = r.name as { ru?: string; uz?: string; en?: string } | string
  if (typeof n === 'string') return n
  return n?.ru || n?.uz || n?.en || `Регион ${r.code}`
}

const barColor = (v: number) => (v >= 70 ? '#3b82f6' : v >= 50 ? '#eab308' : v >= 30 ? '#f97316' : '#ef4444')
</script>
