<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div class="flex flex-wrap items-center gap-3">
      <select v-model="objectType" class="control w-full xs:w-auto" @change="load">
        <option value="school">Школы</option>
        <option value="kindergarten">Детские сады</option>
        <option value="health_post">ФАП и СВП</option>
      </select>
      <span class="text-label text-ink-faint">
        Наборы измерений у типов разные, индексы между типами не сравниваются.
      </span>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!nat?.M0" class="py-24 text-center text-body text-ink-faint">
      Индекс недоступен. Объектов этого типа в базе нет.
    </p>

    <template v-else>
      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatPanel label="M0" :bound="nat.M0" :denominator="`оценено ${fmt(nat.assessed)}, вне оценки ${fmt(nat.notAssessable)}`" hint="H × A, доля депривации с учётом её глубины" />
        <StatPanel label="H" :bound="nat.H" format="percent" unit="%" hint="доля объектов, лишённых по k измерениям и более" />
        <StatPanel label="A" :bound="nat.A" format="percent" unit="%" hint="средняя доля измерений среди депривированных" />
      </div>

      <NoteBlock class="mt-4" title="Метод">
        <p>
          {{ meta.method }}. Измерений d = {{ meta.d }}, порог k = {{ meta.k?.asCount }}/{{ meta.d }}.
          Объект считается депривированным, когда лишён по k измерениям и более.
        </p>
        <p v-if="hasInterval" class="mt-2">
          {{ meta.assumptions?.intervalCause }}. Границы не усредняются: показаны обе.
        </p>
      </NoteBlock>

      <!-- The composite never appears without this. A single index number invites a
           ranking; the decomposition is what a district can actually act on. -->
      <section class="panel mt-4 p-5 sm:p-6">
        <SectionHead
          eyebrow="Разложение"
          title="Депривация по измерениям"
          note="Доля оценённых объектов, лишённых по каждому измерению, независимо от порога k."
        />
        <div class="mt-6 space-y-2.5">
          <ShareBar
            v-for="d in dimensionRows"
            :key="d.key"
            :label="d.label"
            :lower="d.lower"
            :upper="d.upper"
            :color="scale.deficiency(d.lower)"
          />
        </div>
        <p v-if="hasInterval" class="mt-4 text-note text-ink-faint">
          Бледной полосой показана верхняя граница интервала, плотной нижняя.
        </p>
      </section>

      <section class="panel mt-4 p-5 sm:p-6">
        <SectionHead
          eyebrow="География"
          title="Районы"
          :note="`Показано ${ranked.length} из ${districtList.length}. Остальные не набирают порога и не публикуются.`"
        >
          <template #actions>
            <label class="flex items-center gap-2 text-label text-ink-faint">
              минимум оценённых
              <input v-model.number="minAssessed" type="number" min="1" max="50" class="control-sm w-14 tabular">
            </label>
          </template>
        </SectionHead>

        <div class="mt-5">
          <DataTable :columns="columns" :rows="ranked" row-key="districtCode" empty="Ни один район не набирает порога">
            <template #cell-name="{ row }">{{ dName(row) }}</template>
            <template #cell-M0="{ row }">
              <span :style="{ color: scale.deficiency(row.M0.lower) }">{{ interval(row.M0) }}</span>
            </template>
            <template #cell-H="{ row }">{{ interval(row.H) }}</template>
          </DataTable>
        </div>
      </section>

      <NoteBlock class="mt-4" title="Допущения">
        <ul class="space-y-1">
          <li>Порог возраста здания: {{ meta.assumptions?.buildingAgeCutoffYears }} лет. {{ meta.assumptions?.buildingAgeCutoffStatus }}.</li>
          <li v-if="meta.assumptions?.familyKindergartensExcluded">
            Семейные детсады исключены: у них нет проектной мощности, материала стен и года постройки.
          </li>
          <li>Измерения: {{ (meta.dimensions ?? []).map((x: any) => x.label).join(', ') }}.</li>
          <li>{{ meta.caveat }} Срез: {{ meta.asOf }}.</li>
        </ul>
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'

definePageMeta({ layout: 'app', pageTitle: 'Индекс депривации', pageSubtitle: 'Алкире-Фостер по социальной инфраструктуре' })
useSeoMeta({ title: 'Индекс депривации - Y.Map' })

const { $api } = useNuxtApp()
const scale = useScale()
const res = ref<any>(null)
const loading = ref(true)
const objectType = ref('school')
const minAssessed = ref(5)

const load = async () => {
  loading.value = true
  try {
    res.value = await $api<any>('/analytics/deprivation', { query: { objectType: objectType.value } })
  } catch {
    res.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)

const meta = computed(() => res.value?.meta ?? {})
const nat = computed(() => res.value?.data?.national ?? {})
const districtList = computed(() => res.value?.data?.districts ?? [])

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString('ru-RU'))

// A bound that collapsed to a point prints as a point. "0.18 – 0.18" would claim an
// uncertainty that is not there.
const interval = (b: { lower: number | null; upper: number | null } | undefined) => {
  if (!b || (b.lower === null && b.upper === null)) return '-'
  return b.lower === b.upper ? String(b.lower) : `${b.lower ?? '-'} – ${b.upper ?? '-'}`
}

const hasInterval = computed(() => !!nat.value?.M0 && nat.value.M0.lower !== nat.value.M0.upper)

const dimensionRows = computed(() =>
  Object.entries(nat.value?.dimensions ?? {})
    .map(([key, v]: [string, any]) => ({ key, label: v.label, lower: v.lower, upper: v.upper }))
    .sort((a, b) => (b.lower ?? 0) - (a.lower ?? 0)),
)

const columns: Column[] = [
  { key: 'name', label: 'Район', emphasis: true },
  { key: 'districtCode', label: 'Код', align: 'right' },
  { key: 'M0', label: 'M0', align: 'right', emphasis: true },
  { key: 'H', label: 'H', align: 'right' },
  { key: 'assessed', label: 'Оценено', align: 'right' },
  { key: 'notAssessable', label: 'Вне оценки', align: 'right' },
]

const ranked = computed(() => districtList.value.filter((d: any) => d.assessed >= minAssessed.value))
const dName = (d: any) => d?.name?.ru || d?.name?.uz || d?.name?.en || d?.tuman || d?.districtCode || '-'
</script>
