<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- By regions (real - /regions/summary) -->
      <section class="panel p-6">
        <SectionHead
          title="Доля закрытых обращений"
          eyebrow="По регионам"
          :note="`${regions.length} регионов. Регион без обращений показывает 0 % как отсутствие наблюдений, а не как результат.`"
        />
        <div class="mt-6 space-y-4">
          <div v-for="r in sortedRegions" :key="r.code">
            <div class="flex items-baseline justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-body font-medium text-ink dark:text-paper">{{ regionName(r) }}</p>
                <p class="font-mono text-label text-ink-faint">
                  {{ r.issueCount }} обращений · {{ r.objectCount }} объектов
                </p>
              </div>
              <MeasuredValue
                :value="r.resolutionRate ?? 0"
                unit="%"
                :color="barColor(r.resolutionRate ?? 0)"
              />
            </div>
            <div class="span-track mt-2">
              <div
                class="span-lower"
                :style="{ width: (r.resolutionRate ?? 0) + '%', backgroundColor: barColor(r.resolutionRate ?? 0) }"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- By organs (blocked - Agency Dashboard) -->
      <section class="panel p-6">
        <SectionHead title="Разрез по органам" eyebrow="По ведомствам" />
        <NoteBlock class="mt-6" tone="caution" title="Источник не подключён">
          Разрез по органам появится после подключения Agency Dashboard. Пустой график
          вместо этой строки читался бы как ноль обращений, что неверно.
        </NoteBlock>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

// REWORKED to the register design system. The bar colours were four literals
// (#3b82f6 / #eab308 / #f97316 / #ef4444) and had already drifted from the ladder
// used on the map: the same region could be one colour here and another there.
// Both now come from useScale.
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
const scale = useScale()
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

// Higher resolution rate is better, so it goes through completeness rather than
// deficiency.
const barColor = (v: number) => scale.completeness(v / 100)
</script>
