<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!report" class="py-24 text-center text-body text-ink-faint">
      Отчёт недоступен. Коллекция объектов пуста или бэкенд не отвечает.
    </p>

    <template v-else>
      <!-- Framing above the numbers. Every figure below is a statement about a
           register field, not about a building. -->
      <NoteBlock :title="undefined">
        <p class="text-body text-ink dark:text-paper">{{ report.meta?.framing }}</p>
        <p class="mt-2">{{ report.meta?.caveat }} Срез: {{ report.meta?.asOf }}.</p>
      </NoteBlock>

      <div class="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatPanel v-for="k in coverageKpis" :key="k.label" :label="k.label" :value="k.value" :denominator="k.sub" />
      </div>

      <section class="panel mt-4 p-5 sm:p-6">
        <SectionHead
          eyebrow="Архив"
          title="Снимки реестров"
          note="Состояния реестров во времени. Ширина окна между снимками ограничивает точность любой модели переходов, построенной на архиве."
        />

        <!-- An empty archive is the normal starting condition, not a failure. -->
        <p v-if="!timeline.length" class="mt-4 text-body text-ink-muted dark:text-ink-faint">
          Снимков пока нет. Первый снимок задаёт t0, переходы появляются со второго.
        </p>

        <div v-else class="mt-5">
          <DataTable :columns="archiveColumns" :rows="timeline" row-key="sourceApi">
            <template #cell-sourceApi="{ value }">{{ sourceLabel(String(value)) }}</template>
            <template #cell-period="{ row }">{{ dateOnly(row.first) }} - {{ dateOnly(row.last) }}</template>
            <template #cell-medianWindowDays="{ value }">{{ value === null ? '-' : `${value} дн.` }}</template>
          </DataTable>
        </div>
      </section>

      <section v-for="s in report.data.sources" :key="s.source" class="panel mt-4 p-5 sm:p-6">
        <SectionHead :eyebrow="`Источник · ${s.source}`" :title="s.label" :note="`Загружено ${fmt(s.loaded)} записей.`" />

        <div class="mt-6">
          <p class="eyebrow">Заполненность полей</p>
          <div class="mt-3 space-y-2.5">
            <div v-for="f in s.completeness" :key="f.field">
              <ShareBar
                :label="f.label"
                :lower="f.filledPct === null ? null : f.filledPct / 100"
                :color="scale.completeness(f.filledPct === null ? null : f.filledPct / 100)"
                value-width="6rem"
              />
              <!-- High fill does not mean informative. Where it does not, the note
                   sits under the bar rather than in a legend nobody reads. -->
              <p v-if="f.note" class="ml-0 mt-1 text-note text-scale-poor md:ml-[11.75rem]">{{ f.note }}</p>
              <p v-if="f.outsideVocabulary" class="ml-0 mt-1 text-note text-scale-bad md:ml-[11.75rem]">
                значений вне объявленной шкалы: {{ f.outsideVocabulary }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-7 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <p class="eyebrow">Согласованность</p>
            <div class="mt-2">
              <MeasuredValue :value="s.consistency.recordsWithAnyFlagPct" unit="%" size="md" />
            </div>
            <p class="text-note text-ink-faint">{{ fmt(s.consistency.recordsWithAnyFlag) }} записей с флагом из {{ fmt(s.loaded) }}</p>
            <ul class="mt-2 space-y-0.5">
              <li v-for="(c, name) in s.consistency.byFlag" :key="name" class="flex justify-between gap-3 text-label text-ink-muted dark:text-ink-faint">
                <span>{{ flagLabel(String(name)) }}</span><span class="tabular font-medium">{{ c }}</span>
              </li>
            </ul>
          </div>

          <div>
            <p class="eyebrow">Актуальность</p>
            <div class="mt-2">
              <MeasuredValue :value="s.freshness.distinctDays" size="md" />
            </div>
            <p class="text-note text-ink-faint">различных дат обновления</p>
            <p class="mt-1 text-note tabular text-ink-muted dark:text-ink-faint">
              {{ dateOnly(s.freshness.earliest) }} - {{ dateOnly(s.freshness.latest) }}
            </p>
            <p v-if="s.freshness.note" class="mt-2 text-note text-scale-poor">{{ s.freshness.note }}</p>
            <p v-else-if="s.freshness.usableForRecencyModel" class="mt-2 text-note text-scale-ok">
              Поле пригодно для модели актуальности.
            </p>
          </div>

          <div>
            <p class="eyebrow">Координаты</p>
            <div class="mt-2">
              <MeasuredValue :value="s.geocoding.exactPct" unit="%" size="md" />
            </div>
            <p class="text-note text-ink-faint">точных из {{ fmt(s.loaded) }}</p>
            <p v-if="s.geocoding.sharedCoordinate" class="mt-2 text-note text-scale-poor">
              общая координата у {{ fmt(s.geocoding.sharedCoordinate) }} объектов, положение требует полевого уточнения
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'

definePageMeta({ layout: 'app', pageTitle: 'Качество данных', pageSubtitle: 'Что выдерживает поле реестра' })
useSeoMeta({ title: 'Качество данных - Y.Map' })

const { $api } = useNuxtApp()
const scale = useScale()
const report = ref<any>(null)
const timeline = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const [q, t] = await Promise.all([
      $api<any>('/analytics/data-quality'),
      // The archive may be empty; that is a normal state, not a failure.
      $api<any>('/analytics/changes/timeline').catch(() => ({ data: { sources: [] } })),
    ])
    report.value = q?.data ? q : null
    timeline.value = t?.data?.sources ?? []
  } catch {
    report.value = null
  } finally {
    loading.value = false
  }
})

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString('ru-RU'))
const dateOnly = (d: string | null) => (d ? String(d).slice(0, 10) : '-')

const archiveColumns: Column[] = [
  { key: 'sourceApi', label: 'Источник', emphasis: true },
  { key: 'snapshots', label: 'Снимков', align: 'right' },
  { key: 'period', label: 'Период', align: 'right' },
  { key: 'medianWindowDays', label: 'Медианное окно', align: 'right' },
  { key: 'transitionsAvailable', label: 'Переходов', align: 'right' },
]

const SOURCE_LABEL: Record<string, string> = { ssv: 'ФАП и СВП', bogcha: 'Детские сады', maktab44: 'Школы' }
const sourceLabel = (s: string) => SOURCE_LABEL[s] ?? s

const FLAG_LABEL: Record<string, string> = {
  code_length: 'код района не семизначный',
  code_missing: 'код района отсутствует',
  code_unknown: 'кода нет в справочнике',
  district_name_mismatch: 'название района не совпадает с кодом',
  parent_code_mismatch: 'код региона не совпадает с кодом района',
  capacity_zero: 'мощность нулевая',
  enrolment_zero: 'контингент нулевой',
  repair_before_build: 'ремонт раньше постройки',
  load_implausible: 'загруженность выше правдоподобной',
}
const flagLabel = (f: string) => FLAG_LABEL[f] ?? f

const coverageKpis = computed(() => {
  const c = report.value?.data?.coverage
  if (!c) return []
  return [
    { label: 'Объектов загружено', value: fmt(c.objectsLoaded), sub: '' },
    { label: 'Районов с данными', value: fmt(c.districtsWithData), sub: c.districtsInCrosswalk ? `из ${fmt(c.districtsInCrosswalk)} в справочнике` : '' },
    { label: 'Покрытие районов', value: c.districtCoveragePct === null ? '-' : `${c.districtCoveragePct} %`, sub: '' },
    { label: 'Регионов', value: fmt(c.regionsWithData), sub: '' },
  ]
})
</script>
