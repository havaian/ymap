<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!d" class="py-24 text-center text-body text-ink-muted dark:text-ink-faint">
      Не удалось загрузить индекс
    </p>

    <template v-else>
      <SectionHead
        title="Композитный индекс районов"
        eyebrow="Сводная оценка"
        :note="d.meta.method"
      />

      <!-- The method is the finding here, so it is stated before any ranking. A
           composite is a hypothesis about an ordering, and a reader who cannot see
           how it was assembled has no way to disagree with it. -->
      <div class="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <NoteBlock title="Ранги, не min-max">
          Min-max отдаёт шкалу выбросам: один район с невозможной загруженностью прижимает
          все остальные ко дну диапазона, и ошибка в данных становится единицей измерения.
          Ранг к этому нечувствителен. Цена честная: ранг теряет расстояние, поэтому
          рядом с ним показано и само значение.
        </NoteBlock>
        <NoteBlock :title="d.meta.weightsDeclared ? 'Веса заданы в запросе' : 'Веса равные'">
          {{ d.meta.weightsNote }}
          Компоненты, по которым у района нет значения, не считаются нулём: их вес
          перераспределяется на остальные.
        </NoteBlock>
      </div>

      <NoteBlock class="mt-4" tone="caution" title="Устойчивость важнее позиции">
        {{ d.meta.sensitivity.note }}
        Прогонов: {{ d.meta.sensitivity.runs.toLocaleString('ru-RU') }},
        полоса: топ-{{ d.meta.sensitivity.topBand }}.
      </NoteBlock>

      <!-- Controls -->
      <div class="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <label for="composite-type" class="eyebrow block">Тип объектов</label>
          <select id="composite-type" v-model="objectType" class="control mt-1.5">
            <option value="">Все</option>
            <option value="school">Школы</option>
            <option value="kindergarten">Детские сады</option>
            <option value="health_post">ФАП и СВП</option>
          </select>
        </div>
        <div>
          <label for="composite-band" class="eyebrow block">Верхняя полоса</label>
          <select id="composite-band" v-model.number="topBand" class="control mt-1.5">
            <option :value="20">Топ-20</option>
            <option :value="50">Топ-50</option>
            <option :value="100">Топ-100</option>
          </select>
        </div>
        <button
          type="button"
          class="rounded-control border border-rule px-4 py-2 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk"
          @click="showThin = !showThin"
        >
          {{ showThin ? 'Скрыть малые выборки' : 'Показать малые выборки' }}
        </button>
      </div>

      <!-- Weight sliders. Moving them is the point: a ranking that dissolves under a
           different reasonable weighting was never a ranking. -->
      <section class="panel mt-4 p-5">
        <p class="eyebrow">Веса компонентов</p>
        <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div v-for="(c, key) in d.meta.components" :key="key">
            <div class="flex items-baseline justify-between gap-3">
              <label :for="`w-${key}`" class="text-body text-ink dark:text-paper">{{ c.label }}</label>
              <span class="font-mono text-label text-ink-faint">{{ weights[key].toFixed(2) }}</span>
            </div>
            <input
              :id="`w-${key}`"
              v-model.number="weights[key]"
              type="range"
              min="0"
              max="3"
              step="0.25"
              class="mt-2 w-full accent-prussian-600"
            />
            <p class="mt-1 text-label text-ink-faint">{{ c.note }}</p>
          </div>
        </div>
        <button
          type="button"
          class="mt-4 text-body font-semibold text-prussian-600 dark:text-prussian-200"
          @click="resetWeights"
        >
          Вернуть равные веса
        </button>
      </section>

      <p class="mt-6 text-note text-ink-muted dark:text-ink-faint">
        {{ visible.length }} районов из {{ d.districts.length }}, {{ d.meta.objects.toLocaleString('ru-RU') }} объектов.
        Выше = хуже.
      </p>

      <!-- Ranking. The composite never appears without its decomposition: the row
           expands into the four components with value, rank and contribution. -->
      <div class="panel mt-3 divide-y divide-rule dark:divide-night-rule">
        <div v-for="r in visible" :key="r.soato">
          <button
            type="button"
            class="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-paper-sunk dark:hover:bg-night-sunk"
            @click="open = open === r.soato ? null : r.soato"
          >
            <span class="w-8 shrink-0 text-center font-mono text-body text-ink-faint">{{ r.rank ?? '-' }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-body font-medium text-ink dark:text-paper">
                {{ name(r) }}
                <span v-if="r.thinSample" class="ml-1 text-label text-ink-faint">малая выборка</span>
              </span>
              <span class="font-mono text-label text-ink-faint">
                {{ r.soato }} · {{ r.denominators.scorable }} объектов
              </span>
            </span>
            <span class="w-24 shrink-0 text-right">
              <span class="font-mono text-body font-semibold" :style="{ color: scale.deficiency(r.composite) }">
                {{ r.composite != null ? r.composite.toFixed(3) : '-' }}
              </span>
            </span>
            <span class="hidden w-28 shrink-0 text-right sm:block">
              <span class="font-mono text-label" :style="{ color: stabilityColor(r.stabilityInTopBand) }">
                {{ (r.stabilityInTopBand * 100).toFixed(0) }} %
              </span>
              <span class="block text-label text-ink-faint">устойчивость</span>
            </span>
            <ChevronDown :size="16" class="shrink-0 text-ink-faint" :class="open === r.soato ? 'rotate-180' : ''" />
          </button>

          <div v-if="open === r.soato" class="border-t border-rule bg-paper-sunk px-4 py-4 dark:border-night-rule dark:bg-night-sunk">
            <div class="space-y-3">
              <div v-for="(c, key) in r.components" :key="key">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="text-body text-ink dark:text-paper">{{ c.label }}</span>
                  <span class="font-mono text-label text-ink-muted dark:text-ink-faint">
                    <span v-if="c.value != null">значение {{ (c.value * 100).toFixed(1) }} %</span>
                    <span v-else>нет значения</span>
                    <span v-if="c.rank != null"> · ранг {{ (c.rank * 100).toFixed(0) }}</span>
                    · вес {{ c.weight.toFixed(2) }}
                  </span>
                </div>
                <div class="span-track mt-1.5">
                  <div
                    v-if="c.rank != null"
                    class="span-lower"
                    :style="{ width: (c.rank * 100) + '%', backgroundColor: scale.deficiency(c.rank) }"
                  />
                </div>
              </div>
            </div>

            <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-rule pt-4 sm:grid-cols-4 dark:border-night-rule">
              <div v-for="(v, k) in r.denominators" :key="k">
                <dt class="eyebrow">{{ DENOM_LABEL[k] ?? k }}</dt>
                <dd class="mt-0.5 font-mono text-body text-ink dark:text-paper">{{ v }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <NoteBlock class="mt-4" title="Что не входит">
        {{ d.meta.excludes }}
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2, ChevronDown } from 'lucide-vue-next'

// п. 23 плана. The old composites (openbudget 40/25/20/15, analytics 40/35/25) had
// unsourced weights, and three of the four terms in the first ran on the civic
// circuit, which holds no data - so it ranked districts by how few zeros they
// carried. This one runs on the registers only, normalises by rank, declares its
// weights and publishes how much the ranking survives moving them.
definePageMeta({
  layout: 'app',
  pageTitle: 'Композитный индекс',
  pageSubtitle: 'Ранговая нормализация с анализом чувствительности',
})
useSeoMeta({ title: 'Композитный индекс - Y.Map' })

const { $api } = useNuxtApp()
const scale = useScale()

const data = ref<any>(null)
const loading = ref(true)
const open = ref<string | null>(null)
const showThin = ref(false)
const objectType = ref('')
const topBand = ref(50)

const weights = reactive<Record<string, number>>({
  deprivation: 1,
  overload: 1,
  age: 1,
  unmeasured: 1,
})

const d = computed(() => data.value)

const load = async () => {
  loading.value = true
  try {
    const query: Record<string, string | number> = { topBand: topBand.value }
    if (objectType.value) query.objectType = objectType.value
    for (const [k, v] of Object.entries(weights)) query[`w.${k}`] = v
    const res = await $api<any>('/analytics/composite', { query })
    data.value = res.data
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Weight changes are debounced: the endpoint runs a thousand perturbations over
// every district, and firing it on every step of a slider would queue work that is
// superseded before it lands.
let timer: ReturnType<typeof setTimeout> | null = null
watch([weights, objectType, topBand], () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(load, 400)
}, { deep: true })

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const resetWeights = () => {
  for (const k of Object.keys(weights)) weights[k] = 1
}

const visible = computed(() => {
  const list = d.value?.districts ?? []
  return showThin.value ? list : list.filter((r: any) => !r.thinSample)
})

const name = (r: any) => r.name?.ru || r.name?.uz || r.name?.en || r.soato

// A position held in nearly every perturbation is a finding. One that survives a
// third of them is a coin flip wearing a rank, and the colour says so.
const stabilityColor = (s: number) =>
  s >= 0.8 ? scale.SCALE_COLORS.ok
    : s >= 0.5 ? scale.SCALE_COLORS.mild
      : scale.SCALE_COLORS.none

const DENOM_LABEL: Record<string, string> = {
  objects: 'Всего записей',
  scorable: 'Оцениваемых',
  assessed: 'В индексе',
  notAssessable: 'Вне оценки',
  loadable: 'С загруженностью',
  ageKnown: 'С определимым возрастом',
}
</script>
