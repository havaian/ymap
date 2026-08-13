<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <!-- Тип объекта и цикл: до xs каждый контрол занимает свою строку целиком,
         иначе подпись «нормативный цикл, лет» с полем переносится посередине. -->
    <div class="flex flex-col gap-3 xs:flex-row xs:flex-wrap xs:items-center">
      <select v-model="objectType" class="control w-full xs:w-auto" @change="load">
        <option value="school">Школы</option>
        <option value="kindergarten">Детские сады</option>
      </select>
      <label class="flex items-center gap-2 text-label text-ink-faint">
        нормативный цикл, лет
        <input v-model.number="cycleYears" type="number" min="5" max="80" class="control-sm w-16 tabular" @change="load">
      </label>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!nat" class="py-24 text-center text-body text-ink-faint">
      Расчёт недоступен. У объектов этого типа нет пригодного года постройки.
    </p>

    <template v-else>
      <!-- Two readings of one field, side by side and the same size. Showing either
           one alone would hide the only thing this page has to say. -->
      <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div v-for="h in hypotheses" :key="h.key" class="panel p-5 sm:p-6">
          <p class="eyebrow">{{ h.eyebrow }}</p>
          <p class="mt-1 text-body text-ink-muted dark:text-ink-faint">{{ h.title }}</p>
          <div class="mt-4">
            <MeasuredValue :value="h.pastPct" unit="%" size="lg" :color="h.color" />
          </div>
          <p class="mt-1 text-note text-ink-muted dark:text-ink-faint">зданий за пределом нормативного цикла</p>
          <p class="mt-3 text-note text-ink-faint">
            медиана R {{ h.medianR }}, медианный возраст {{ h.medianAge }} лет
          </p>
        </div>
      </div>

      <NoteBlock class="mt-4" title="Почему две гипотезы, а не одна">
        <p>{{ meta.whyTwo }}</p>
        <p class="mt-2">
          Запись о ремонте есть у {{ pct(nat.withRepairRecord, nat.assessed) }} % объектов
          ({{ fmt(nat.withRepairRecord) }} из {{ fmt(nat.assessed) }}).
          Нормативный цикл {{ meta.cycleYears }} лет, {{ meta.cycleStatus }}.
        </p>
      </NoteBlock>

      <section class="panel mt-4 p-5 sm:p-6">
        <SectionHead eyebrow="География" title="Районы" :note="`Показано ${ranked.length} из ${districts.length}. Обе гипотезы в одной строке: расхождение между ними и есть то, что планировщику нужно увидеть до решения о деньгах.`">
          <template #actions>
            <select v-model="ordering" class="control-sm">
              <option value="capital">сортировать по H1</option>
              <option value="current">сортировать по H2</option>
            </select>
          </template>
        </SectionHead>

        <div class="mt-5">
          <DataTable :columns="districtColumns" :rows="ranked" row-key="districtCode" empty="Ни один район не набирает порога">
            <template #cell-name="{ row }">{{ dName(row) }}</template>
            <template #cell-h1="{ row }">
              <span :style="{ color: scale.deficiency(row.pastCycleShare.capital) }">{{ share(row.pastCycleShare.capital) }}</span>
            </template>
            <template #cell-h2="{ row }">
              <span :style="{ color: scale.deficiency(row.pastCycleShare.current) }">{{ share(row.pastCycleShare.current) }}</span>
            </template>
            <template #cell-adobeCount="{ row }">
              <span :style="{ color: row.adobeCount ? scale.deficiency(0.4) : undefined }">{{ row.adobeCount || '-' }}</span>
            </template>
          </DataTable>
        </div>
      </section>

      <section class="panel mt-4 p-5 sm:p-6">
        <SectionHead
          eyebrow="Объекты"
          title="Приоритет"
          :note="`${meta.priorityFormula}. Произведение, а не сумма: новое здание не становится срочным от размера, а старое без контингента не срочно вовсе.`"
        />
        <div class="mt-5">
          <DataTable :columns="facilityColumns" :rows="topSorted" row-key="objectId" empty="Нет объектов">
            <template #cell-years="{ row }">
              {{ row.buildYear }}<template v-if="row.repairYear"> / {{ row.repairYear }}</template>
            </template>
            <template #cell-material="{ row }">
              <span :style="{ color: row.material === 'paxsa' ? scale.deficiency(0.4) : undefined }">{{ row.material ?? '-' }}</span>
            </template>
            <template #cell-enrolment="{ row }">{{ fmt(row.enrolment) }}</template>
            <template #cell-priority="{ row }">{{ row.priority[ordering] }}</template>
          </DataTable>
        </div>
      </section>

      <NoteBlock class="mt-4" tone="caution" title="Что не применено">
        <p>{{ meta.seismic?.reason }}</p>
      </NoteBlock>

      <NoteBlock class="mt-4" title="Знаменатели">
        <p>
          Оценено {{ fmt(meta.denominators?.assessed) }} из {{ fmt(meta.denominators?.objectsInScope) }};
          без года постройки {{ fmt(meta.denominators?.withoutBuildYear) }},
          без материала стен {{ fmt(meta.denominators?.withoutMaterial) }}.
          {{ meta.caveat }} Срез: {{ meta.asOf }}.
        </p>
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'

definePageMeta({ layout: 'app', pageTitle: 'Износ', pageSubtitle: 'Нормативный учёт под двумя прочтениями поля ремонта' })
useSeoMeta({ title: 'Износ - Y.Map' })

const { $api } = useNuxtApp()
const scale = useScale()
const res = ref<any>(null)
const loading = ref(true)
const objectType = ref('school')
const cycleYears = ref(30)
const ordering = ref<'capital' | 'current'>('capital')

const load = async () => {
  loading.value = true
  try {
    res.value = await $api<any>('/analytics/wear', {
      query: { objectType: objectType.value, cycleYears: cycleYears.value, limit: 25 },
    })
  } catch {
    res.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)

const nat = computed(() => res.value?.data?.national ?? null)
const meta = computed(() => res.value?.meta ?? {})
const districts = computed(() => res.value?.data?.districts ?? [])

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString('ru-RU'))
const pct = (a: number, b: number) => (b ? ((a / b) * 100).toFixed(1) : '-')
const share = (v: number | null) => (v === null || v === undefined ? '-' : `${(v * 100).toFixed(1)} %`)

const hypotheses = computed(() => {
  const n = nat.value
  if (!n) return []
  const h = meta.value?.hypotheses ?? {}
  return [
    { key: 'capital', eyebrow: 'H1', title: h.capital, pastPct: n.capital.pastCyclePct, medianR: n.capital.R.p50, medianAge: n.capital.medianAgeYears, color: scale.SCALE_COLORS.fair },
    { key: 'current', eyebrow: 'H2', title: h.current, pastPct: n.current.pastCyclePct, medianR: n.current.R.p50, medianAge: n.current.medianAgeYears, color: scale.SCALE_COLORS.bad },
  ]
})

const districtColumns: Column[] = [
  { key: 'name', label: 'Район', emphasis: true },
  { key: 'h1', label: 'За циклом, H1', align: 'right' },
  { key: 'h2', label: 'За циклом, H2', align: 'right' },
  { key: 'adobeCount', label: 'Глинобит', align: 'right' },
  { key: 'facilities', label: 'Объектов', align: 'right' },
]

const facilityColumns: Column[] = [
  { key: 'name', label: 'Объект', emphasis: true },
  { key: 'tuman', label: 'Район' },
  { key: 'years', label: 'Постройка / ремонт', align: 'right' },
  { key: 'material', label: 'Материал', align: 'right' },
  { key: 'enrolment', label: 'Контингент', align: 'right' },
  { key: 'priority', label: 'Приоритет', align: 'right', emphasis: true },
]

// Sorted here rather than refetched: both readings are already in the payload, and
// a round trip would suggest the numbers themselves change with the sort.
const ranked = computed(() =>
  [...districts.value]
    .filter((d: any) => !d.belowThreshold)
    .sort((a: any, b: any) => b.pastCycleShare[ordering.value] - a.pastCycleShare[ordering.value]),
)

const topSorted = computed(() =>
  [...(res.value?.data?.topFacilities ?? [])].sort((a: any, b: any) => b.priority[ordering.value] - a.priority[ordering.value]),
)

const dName = (d: any) => d?.name?.ru || d?.name?.uz || d?.name?.en || d?.tuman || d?.districtCode || '-'
</script>
