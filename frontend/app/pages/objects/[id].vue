<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!d" class="py-24 text-center text-body text-ink-muted dark:text-ink-faint">
      Объект не найден
    </p>

    <template v-else>
      <!-- Identity -->
      <section class="panel p-6">
        <p class="eyebrow">{{ d.object.objectTypeLabel }}</p>
        <h1 class="mt-2 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
          {{ d.object.name }}
        </h1>
        <p v-if="d.object.nameRu && d.object.nameRu !== d.object.name" class="mt-1 text-body text-ink-muted dark:text-ink-faint">
          {{ d.object.nameRu }}
        </p>

        <dl class="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-rule pt-5 sm:grid-cols-4 dark:border-night-rule">
          <div>
            <dt class="eyebrow">Район</dt>
            <dd class="mt-1 text-body text-ink dark:text-paper">{{ districtName }}</dd>
          </div>
          <div>
            <dt class="eyebrow">СОАТО</dt>
            <dd class="mt-1 font-mono text-body text-ink dark:text-paper">{{ d.district.soato ?? '-' }}</dd>
          </div>
          <div>
            <dt class="eyebrow">Реестр</dt>
            <dd class="mt-1 font-mono text-body text-ink dark:text-paper">{{ d.object.sourceApi }}</dd>
          </div>
          <div>
            <dt class="eyebrow">ИНН</dt>
            <dd class="mt-1 font-mono text-body text-ink dark:text-paper">{{ d.object.inn ?? '-' }}</dd>
          </div>
        </dl>

        <!-- Provenance of the coordinate, not just the coordinate. A point copied
             across several facilities in the source registry is a valid pair of
             numbers and an unknown position, and those are different things. -->
        <div class="mt-5 border-t border-rule pt-4 dark:border-night-rule">
          <p class="eyebrow">Координата</p>
          <p class="mt-1 text-body text-ink dark:text-paper">
            <span v-if="d.object.lat != null" class="font-mono">{{ d.object.lat.toFixed(5) }}, {{ d.object.lng.toFixed(5) }}</span>
            <span v-else class="text-ink-faint">не известна</span>
          </p>
          <p class="mt-1 text-note text-ink-muted dark:text-ink-faint">
            Источник: {{ d.object.coordSourceLabel }}
          </p>
          <NoteBlock v-if="d.object.coordShared" class="mt-3" tone="caution">
            Эта координата в реестре повторяется у нескольких объектов. Точка стоит на карте,
            но положение конкретно этого здания полевой проверкой не подтверждено.
          </NoteBlock>
        </div>
      </section>

      <!-- Readings -->
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatPanel
          label="Контингент"
          :value="fmt(d.readings.enrolment)"
          :denominator="d.readings.capacity != null ? `Проектная мощность ${fmt(d.readings.capacity)}` : 'Проектная мощность не указана'"
        />
        <StatPanel
          label="Загруженность"
          :value="d.readings.loadFactor != null ? d.readings.loadFactor.toFixed(2) : '-'"
          :denominator="loadClassLabel"
        />
        <StatPanel
          label="Сверх одной смены"
          :value="fmt(d.readings.seatsOverSingleShift)"
          :denominator="d.readings.shifts ? `Смен по реестру: ${d.readings.shifts}` : 'Число смен не указано'"
        />
        <StatPanel
          label="Возраст здания"
          :value="ageValue"
          :denominator="ageNote"
        />
      </div>

      <!-- Deprivation, decomposed. The composite never appears alone. -->
      <section v-if="d.deprivation" class="panel mt-4 p-6">
        <SectionHead
          title="Разложение по измерениям"
          eyebrow="Депривация"
          :note="`${d.deprivation.dimensionCount} измерений, порог ${(d.deprivation.kShare * 100).toFixed(0)} % от их числа.`"
        />

        <div v-if="d.deprivation.assessable" class="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-rule pb-5 dark:border-night-rule">
          <MeasuredValue
            :bound="{ lower: d.deprivation.cLower, upper: d.deprivation.cUpper }"
            format="percent"
            :digits="0"
            size="lg"
            bound-hint="Интервал возникает там, где измерение неопределимо: обе границы публикуются, середина - нет."
          />
          <p class="text-note text-ink-muted dark:text-ink-faint">
            доля измерений, по которым объект депривирован
          </p>
          <span
            class="rounded-control px-2.5 py-1 text-label font-semibold"
            :style="{ backgroundColor: verdictBg, color: verdictColor }"
          >
            {{ verdictText }}
          </span>
        </div>

        <NoteBlock v-else class="mt-5" tone="caution" title="Объект не оценивается">
          Измерение «{{ dimLabel(d.deprivation.missingDimension) }}» в записи пустое.
          Пустое поле - это не ноль и не худшее значение, поэтому объект исключён из индекса,
          а не посчитан по нижней границе.
        </NoteBlock>

        <div class="mt-5 divide-y divide-rule dark:divide-night-rule">
          <div
            v-for="dim in d.deprivation.dimensions"
            :key="dim.key"
            class="flex items-center gap-4 py-3"
          >
            <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :style="{ backgroundColor: dimColor(dim.status) }" />
            <span class="min-w-0 flex-1 text-body text-ink dark:text-paper">{{ dim.label }}</span>
            <span class="hidden max-w-[14rem] truncate font-mono text-label text-ink-faint sm:inline">
              {{ dim.sourceValue ?? '' }}
            </span>
            <span class="w-32 shrink-0 text-right text-label" :style="{ color: dimColor(dim.status) }">
              {{ DIM_STATUS[dim.status] }}
            </span>
          </div>
        </div>
      </section>

      <NoteBlock v-else class="mt-4" title="Семейный детский сад">
        Объект работает в квартире или частном доме. У него нет года постройки, материала стен
        и проектной мощности в том смысле, который предполагают модели состояния, поэтому он
        участвует только в модели доступности как точка обслуживания.
      </NoteBlock>

      <!-- Quality flags -->
      <section v-if="d.quality.flags.length" class="panel mt-4 p-6">
        <SectionHead title="Отметки качества записи" eyebrow="Импорт" />
        <ul class="mt-4 space-y-2">
          <li v-for="f in d.quality.flags" :key="f.key" class="flex items-start gap-3">
            <AlertTriangle :size="15" class="mt-0.5 shrink-0" :style="{ color: SCALE_COLORS.mild }" />
            <div>
              <p class="text-body text-ink dark:text-paper">{{ f.label }}</p>
              <p class="font-mono text-label text-ink-faint">{{ f.key }}</p>
            </div>
          </li>
        </ul>
      </section>

      <!-- Archive history -->
      <section class="panel mt-4 p-6">
        <SectionHead
          title="История записи"
          eyebrow="Архив"
          note="Изменение произошло где-то внутри окна между двумя снимками. Архив сузить его не может."
        />

        <NoteBlock v-if="d.archive.state === 'no_snapshots'" class="mt-5" tone="caution" title="Снимков нет">
          Архив ещё не начат. До первого прогона take-snapshot.js история этой записи не существует
          и восстановить её задним числом нельзя.
        </NoteBlock>

        <NoteBlock v-else-if="d.archive.state === 'baseline_only'" class="mt-5" title="Только точка отсчёта">
          Снимок один. Переходы появляются со второго: пара снимков даёт изменение, один снимок
          даёт только состояние.
        </NoteBlock>

        <p v-else-if="!d.archive.history.length" class="mt-5 text-body text-ink-muted dark:text-ink-faint">
          Между снимками эта запись не менялась.
        </p>

        <div v-else class="mt-5 divide-y divide-rule dark:divide-night-rule">
          <div v-for="(h, i) in d.archive.history" :key="i" class="py-3">
            <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p class="text-body text-ink dark:text-paper">
                <span class="font-medium">{{ KIND_LABEL[h.kind] ?? h.kind }}</span>
                <span v-if="h.field" class="font-mono text-note text-ink-muted dark:text-ink-faint"> · {{ h.field }}</span>
              </p>
              <p class="font-mono text-label text-ink-faint">{{ windowText(h) }}</p>
            </div>
            <p v-if="h.kind === 'changed'" class="mt-1 font-mono text-note">
              <span class="text-ink-faint">{{ h.from ?? 'пусто' }}</span>
              <span class="mx-2 text-ink-muted dark:text-ink-faint">→</span>
              <span class="text-ink dark:text-paper">{{ h.to ?? 'пусто' }}</span>
            </p>
          </div>
        </div>
      </section>

      <NoteBlock class="mt-4" title="Допущение">
        {{ d.assumptions.buildingAgeCutoffNote }}
        Текущий порог: {{ d.assumptions.buildingAgeCutoff }} лет.
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2, AlertTriangle } from 'lucide-vue-next'

// The facility card (п. 34.6). This is the level at which a claim can be checked:
// a district figure is an aggregate nobody can walk up to, a named school with a
// SOATO code and a construction year is something a person standing in front of it
// can confirm or dispute. So every verdict here sits next to the registry value it
// came from, and every assumption is printed rather than applied silently.
definePageMeta({
  layout: 'app',
  pageTitle: 'Объект',
  pageSubtitle: 'Карточка записи реестра',
})

const route = useRoute()
const { $api } = useNuxtApp()
const { SCALE_COLORS } = useScale()

const data = ref<any>(null)
const loading = ref(true)

const d = computed(() => data.value)

onMounted(async () => {
  try {
    const res = await $api<any>(`/objects/${route.params.id}/profile`)
    data.value = res.data
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
})

useSeoMeta({ title: () => (d.value ? `${d.value.object.name} - Y.Map` : 'Объект - Y.Map') })

const fmt = (n: number | null) => (n === null || n === undefined ? '-' : n.toLocaleString('ru-RU'))

const districtName = computed(() => {
  const n = d.value?.district?.name
  return n?.ru || n?.uz || n?.en || '-'
})

const LOAD_CLASS_LABEL: Record<string, string> = {
  normal: 'В пределах мощности',
  hidden_overload: 'Скрытая перегрузка: две смены при загрузке до единицы',
  acute: 'Острая: выше мощности при одной смене',
  chronic: 'Хроническая: выше мощности при двух сменах',
  critical: 'Критическая: выше полутора мощностей',
}
const loadClassLabel = computed(() => {
  const c = d.value?.readings?.loadClass
  return c ? LOAD_CLASS_LABEL[c] ?? c : 'Класс не определён'
})

// The age reason matters more than the number. ssv construction years are a
// placeholder in about 85 % of records, and printing an age derived from one would
// be an artefact of the loader presented as a measurement.
const AGE_REASON: Record<string, string> = {
  source_year_placeholder: 'Год постройки в этом реестре - заглушка, возраст не считается',
  build_year_missing: 'Год постройки не указан',
  repair_recorded: 'От года капитального ремонта',
  no_repair: 'От года постройки, ремонт не записан',
}
const ageValue = computed(() => {
  const a = d.value?.readings?.buildingAge
  return a?.age != null ? `${a.age} лет` : '-'
})
const ageNote = computed(() => {
  const a = d.value?.readings?.buildingAge
  if (!a) return ''
  return AGE_REASON[a.reason] ?? a.reason ?? ''
})

const DIM_STATUS: Record<string, string> = {
  deprived: 'депривирован',
  ok: 'в норме',
  uncertain: 'неопределённо',
  missing: 'поле пустое',
}
const dimColor = (status: string) =>
  status === 'deprived' ? SCALE_COLORS.bad
    : status === 'ok' ? SCALE_COLORS.ok
      : SCALE_COLORS.none

const dimLabel = (key: string | null) =>
  d.value?.deprivation?.dimensions?.find((x: any) => x.key === key)?.label ?? key ?? ''

// The verdict is itself an interval when c_i straddles the cutoff. Saying "depends
// on the uncertain dimension" is the honest answer and the one the reader can act
// on: it names what to go and check.
const verdictText = computed(() => {
  const dep = d.value?.deprivation
  if (!dep?.assessable) return ''
  if (dep.deprivedLower && dep.deprivedUpper) return 'депривирован'
  if (!dep.deprivedLower && !dep.deprivedUpper) return 'не депривирован'
  return 'зависит от неопределённого измерения'
})
const verdictColor = computed(() => {
  const dep = d.value?.deprivation
  if (dep?.deprivedLower && dep?.deprivedUpper) return SCALE_COLORS.bad
  if (!dep?.deprivedLower && !dep?.deprivedUpper) return SCALE_COLORS.ok
  return SCALE_COLORS.mild
})
const verdictBg = computed(() => `${verdictColor.value}1A`)

const KIND_LABEL: Record<string, string> = {
  added: 'Запись появилась',
  removed: 'Запись исчезла',
  changed: 'Поле изменилось',
}

const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ru-RU') : null)
const windowText = (h: any) => {
  const from = dt(h.observedFrom)
  const to = dt(h.observedTo)
  return from ? `${from} – ${to}` : `до ${to}`
}
</script>
