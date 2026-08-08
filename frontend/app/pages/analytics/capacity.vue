<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div class="flex flex-wrap items-center gap-2">
      <select v-model="objectType" class="control" @change="load">
        <option value="school">Школы</option>
        <option value="kindergarten">Детские сады</option>
      </select>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!nat" class="py-24 text-center text-body text-ink-faint">
      Данных о мощности нет. Объектов этого типа в базе нет.
    </p>

    <template v-else>
      <div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatPanel label="Мест по проекту" :value="fmt(nat.capacity)" :denominator="`${fmt(nat.facilities)} объектов`" />
        <StatPanel label="Контингент" :value="fmt(nat.enrolment)" />
        <StatPanel label="Загруженность" :value="nat.loadFactor" :hint="nat.loadFactor > 1 ? 'мест меньше, чем учеников' : ''" />
      </div>

      <!-- Three numbers, three decisions. A single total would answer none of them. -->
      <section class="panel mt-4 p-6">
        <SectionHead
          eyebrow="Дефицит мест"
          title="Три числа на три решения"
          note="Каждая строка отвечает на свой вопрос, а не является частью одной суммы."
        />

        <div class="mt-6 space-y-5">
          <div v-for="d in deficitRows" :key="d.key">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <span class="text-body font-medium text-ink dark:text-paper">{{ d.title }}</span>
              <MeasuredValue :value="fmt(d.value)" :color="d.color" size="md" />
            </div>
            <span class="span-track mt-2 block">
              <span class="span-lower" :style="{ width: `${d.share}%`, background: d.color }" />
            </span>
            <p class="mt-1 text-note text-ink-faint">{{ d.hint }}</p>
          </div>
        </div>
      </section>

      <section v-if="classRows.length" class="panel mt-4 p-6">
        <SectionHead
          eyebrow="Нагрузка"
          title="Классы нагрузки"
          note="Состояние описывается парой «загруженность и сменность». Одно число здесь теряет разницу между полной школой в одну смену и полной школой в две."
        />
        <div class="mt-6 space-y-2.5">
          <ShareBar
            v-for="c in classRows"
            :key="c.key"
            :label="c.label"
            :lower="c.share"
            :color="c.color"
            value-width="8rem"
          />
        </div>
      </section>

      <NoteBlock class="mt-4" tone="caution" title="Прогноз не публикуется">
        <p>{{ forecast.reason }}</p>
        <p class="mt-2">{{ forecast.property }}</p>
        <ul class="mt-2 list-inside list-disc">
          <li v-for="r in forecast.requires ?? []" :key="r">{{ r }}</li>
        </ul>
      </NoteBlock>

      <section class="panel mt-4 p-6">
        <SectionHead
          eyebrow="География"
          title="Районы"
          :note="`Показано ${ranked.length} из ${districts.length}. Районы с меньшим числом объектов не публикуются: доля по двум школам говорит о выборке, а не о районе.`"
        />
        <div class="mt-5">
          <DataTable :columns="columns" :rows="ranked" row-key="districtCode" empty="Ни один район не набирает порога">
            <template #cell-name="{ row }">{{ dName(row) }}</template>
            <template #cell-capacity="{ row }">{{ fmt(row.capacity) }}</template>
            <template #cell-enrolment="{ row }">{{ fmt(row.enrolment) }}</template>
            <template #cell-loadFactor="{ row }">
              <span :style="{ color: row.loadFactor > 1 ? scale.deficiency(0.4) : undefined }">{{ row.loadFactor ?? '-' }}</span>
            </template>
            <template #cell-deficit="{ row }">
              {{ fmt(row.deficit.aboveTwoShifts ?? row.deficit.aboveOneShift) }}
            </template>
          </DataTable>
        </div>
      </section>

      <NoteBlock class="mt-4" title="Как это посчитано">
        <p>{{ meta.capacityReading }}</p>
        <p class="mt-2">
          {{ meta.caveat }} Учтено {{ fmt(meta.denominators?.counted) }} из {{ fmt(meta.denominators?.objectsInScope) }},
          исключено по качеству данных {{ fmt(meta.denominators?.excludedForDataQuality) }}. Срез: {{ meta.asOf }}.
        </p>
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import type { Column } from '~/components/ui/DataTable.vue'

definePageMeta({ layout: 'app', pageTitle: 'Мощность', pageSubtitle: 'Дефицит мест по районам' })
useSeoMeta({ title: 'Мощность - Y.Map' })

const { $api } = useNuxtApp()
const scale = useScale()
const res = ref<any>(null)
const loading = ref(true)
const objectType = ref('school')

const load = async () => {
  loading.value = true
  try {
    res.value = await $api<any>('/analytics/capacity', { query: { objectType: objectType.value } })
  } catch {
    res.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)

const nat = computed(() => res.value?.data?.national ?? null)
const meta = computed(() => res.value?.meta ?? {})
const forecast = computed(() => meta.value?.forecast ?? {})
const districts = computed(() => res.value?.data?.districts ?? [])
const ranked = computed(() => districts.value.filter((d: any) => !d.belowThreshold))

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString('ru-RU'))

const columns: Column[] = [
  { key: 'name', label: 'Район', emphasis: true },
  { key: 'capacity', label: 'Мест', align: 'right' },
  { key: 'enrolment', label: 'Учеников', align: 'right' },
  { key: 'loadFactor', label: 'L', align: 'right' },
  { key: 'deficit', label: 'Сверх 2 смен', align: 'right', emphasis: true },
  { key: 'facilities', label: 'Объектов', align: 'right' },
]

// Bars scale to the largest of the three so the reader sees how much smaller the
// structural part is than the headline one. That contrast is the message.
const deficitRows = computed(() => {
  const d = nat.value?.deficit
  if (!d) return []
  const defs = meta.value?.deficitDefinitions ?? {}
  const rows = [
    { key: 'aboveOneShift', title: 'Сверх одной смены', value: d.aboveOneShift, hint: defs.aboveOneShift, color: scale.SCALE_COLORS.mild },
    { key: 'aboveActualShifts', title: 'Сверх фактических смен', value: d.aboveActualShifts, hint: defs.aboveActualShifts, color: scale.SCALE_COLORS.poor },
    { key: 'aboveTwoShifts', title: 'Сверх двух смен', value: d.aboveTwoShifts, hint: defs.aboveTwoShifts, color: scale.SCALE_COLORS.bad },
  ].filter((r) => r.value !== null && r.value !== undefined)
  const max = Math.max(...rows.map((r) => r.value as number), 1)
  return rows.map((r) => ({ ...r, share: Math.round(((r.value as number) / max) * 100) }))
})

const CLASS_META: Record<string, { label: string; color: string }> = {
  normal: { label: 'Норма', color: scale.SCALE_COLORS.ok },
  hidden_overload: { label: 'Скрытая перегрузка', color: scale.SCALE_COLORS.none },
  acute: { label: 'Острая', color: scale.SCALE_COLORS.mild },
  chronic: { label: 'Хроническая', color: scale.SCALE_COLORS.poor },
  critical: { label: 'Критическая', color: scale.SCALE_COLORS.bad },
  undetermined: { label: 'Не определён', color: scale.SCALE_COLORS.none },
}

const classRows = computed(() => {
  const c = nat.value?.classes
  if (!c) return []
  const total = (Object.values(c) as number[]).reduce((a, b) => a + b, 0)
  return Object.entries(c)
    .map(([key, count]: [string, any]) => ({
      key,
      label: CLASS_META[key]?.label ?? key,
      color: CLASS_META[key]?.color ?? scale.SCALE_COLORS.none,
      count,
      share: total ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count)
})

const dName = (d: any) => d?.name?.ru || d?.name?.uz || d?.name?.en || d?.tuman || d?.districtCode || '-'
</script>
