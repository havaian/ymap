<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div class="flex flex-wrap items-center gap-2">
      <select v-model="objectType" class="control" @change="load">
        <option value="school">Школы</option>
        <option value="kindergarten">Детские сады</option>
        <option value="health_post">ФАП и СВП</option>
      </select>
      <button type="button" class="control" :disabled="loading" @click="load">Обновить очередь</button>
    </div>

    <p class="mt-3 text-body text-ink-muted dark:text-ink-faint">
      {{ meta.framing || 'Очередь указывает, какую запись реестра стоит уточнить на месте.' }}
    </p>

    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!items.length" class="py-24 text-center text-body text-ink-faint">
      Очередь пуста. Объектов под фильтр нет либо у выбранных источников нет общих полей состояния.
    </p>

    <template v-else>
      <div class="mt-5 space-y-3">
        <article v-for="(it, i) in items" :key="`${it.objectId}-${it.field}`" class="panel p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium leading-tight text-ink dark:text-paper">{{ it.name }}</p>
              <p class="mt-0.5 text-label tabular text-ink-faint">{{ it.tuman }} · {{ it.districtCode }}</p>
            </div>
            <!-- Which arm this came from is shown, not hidden. Someone answering a
                 ranked queue should be able to see that it is ranked. -->
            <span
              class="shrink-0 rounded-control px-2 py-1 text-eyebrow uppercase"
              :class="it.selection === 'random'
                ? 'bg-paper-sunk text-ink-faint dark:bg-night-sunk'
                : 'bg-prussian-50 text-prussian-600 dark:bg-prussian-900/40 dark:text-prussian-200'"
              :title="it.selection === 'random' ? randomHint : targetedHint"
            >
              {{ it.selection === 'random' ? 'случайная' : 'по приоритету' }}
            </span>
          </div>

          <div class="mt-3 flex flex-wrap items-baseline gap-2">
            <span class="text-label text-ink-faint">{{ fieldLabel(it.field) }}</span>
            <span class="font-mono text-body text-ink dark:text-paper">{{ it.currentValue ?? 'не заполнено' }}</span>
          </div>

          <div v-if="it.reasons.length" class="mt-2 flex flex-wrap gap-1.5">
            <span v-for="r in it.reasons" :key="r.code" class="rounded-control bg-scale-mild/10 px-2 py-0.5 text-label text-scale-mild">
              {{ r.label }}
            </span>
          </div>

          <button type="button" class="mt-3 text-eyebrow uppercase text-ink-faint transition-colors hover:text-ink dark:hover:text-paper" @click="expanded[i] = !expanded[i]">
            {{ expanded[i] ? 'скрыть разбор' : `разбор оценки ${it.priorityScore}` }}
          </button>

          <div v-if="expanded[i]" class="mt-3 space-y-1.5">
            <div v-for="(v, k) in it.components" :key="k" class="flex items-center gap-3">
              <span class="w-40 shrink-0 text-label text-ink-muted dark:text-ink-faint">{{ componentLabel(String(k)) }}</span>
              <span class="span-track h-1.5 flex-1">
                <span class="span-lower bg-prussian-400" :style="{ width: `${(v ?? 0) * 100}%` }" />
              </span>
              <span class="w-12 shrink-0 text-right text-label tabular text-ink-muted dark:text-ink-faint">{{ v }}</span>
              <span class="w-10 shrink-0 text-right text-label tabular text-ink-faint">×{{ meta.weights?.[k] ?? '-' }}</span>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="rounded-control border px-3 py-2 text-body font-medium transition-colors"
              :class="answers[key(it)] === 'confirmed'
                ? 'border-scale-ok bg-scale-ok text-paper'
                : 'border-rule text-ink-muted hover:bg-paper-sunk dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk'"
              :disabled="pending[key(it)]"
              @click="answer(it, 'confirmed')"
            >
              Соответствует
            </button>
            <button
              type="button"
              class="rounded-control border px-3 py-2 text-body font-medium transition-colors"
              :class="answers[key(it)] === 'disputed'
                ? 'border-scale-bad bg-scale-bad text-paper'
                : 'border-rule text-ink-muted hover:bg-paper-sunk dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk'"
              :disabled="pending[key(it)]"
              @click="answer(it, 'disputed')"
            >
              Не соответствует
            </button>
            <span v-if="errors[key(it)]" class="text-label text-scale-bad">{{ errors[key(it)] }}</span>
          </div>
        </article>
      </div>

      <NoteBlock class="mt-5" title="Как собрана очередь">
        <p>
          {{ meta.targetedSlots }} позиций по приоритету, {{ meta.randomSlots }} случайных из
          {{ fmt(eligible) }} возможных. Случайная доля {{ meta.randomShare }}.
        </p>
        <p class="mt-1">{{ meta.note }}</p>
        <p v-if="meta.stalenessDroppedForSources?.length" class="mt-1">
          Компонент давности отключён для источников: {{ meta.stalenessDroppedForSources.join(', ') }}.
        </p>
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'

definePageMeta({ layout: 'app', pageTitle: 'Очередь верификации', pageSubtitle: 'Какие записи реестра стоит уточнить' })
useSeoMeta({ title: 'Очередь верификации - Y.Map' })

const { $api } = useNuxtApp()
const items = ref<any[]>([])
const meta = ref<any>({})
const eligible = ref(0)
const loading = ref(true)
const objectType = ref('school')
const expanded = reactive<Record<number, boolean>>({})
const answers = reactive<Record<string, string>>({})
const pending = reactive<Record<string, boolean>>({})
const errors = reactive<Record<string, string>>({})

const key = (it: any) => `${it.objectId}:${it.field}`

const targetedHint = 'Позиция выбрана правилами приоритета.'
const randomHint =
  'Позиция выбрана жребием из всех кандидатов. Случайная доля нужна, чтобы собранные ответы можно было переоценить и не обучать модель на собственном ранжировании.'

const load = async () => {
  loading.value = true
  for (const k of Object.keys(expanded)) delete expanded[Number(k)]
  try {
    const res = await $api<any>('/analytics/verification-queue', { query: { objectType: objectType.value, limit: 20 } })
    items.value = res?.data?.items ?? []
    eligible.value = res?.data?.eligibleCandidates ?? 0
    meta.value = res?.meta ?? {}
  } catch {
    items.value = []
    meta.value = {}
  } finally {
    loading.value = false
  }
}
onMounted(load)

const answer = async (it: any, status: 'confirmed' | 'disputed') => {
  const k = key(it)
  pending[k] = true
  delete errors[k]
  try {
    await $api(`/objects/${it.objectId}/indicator-verifications`, { method: 'POST', body: { field: it.field, status } })
    answers[k] = status
  } catch (e: any) {
    // The endpoint requires a signed-in user. Naming the failure beats a silent
    // no-op on a button someone just pressed.
    errors[k] = e?.response?.status === 401 ? 'Нужен вход в систему' : 'Не удалось отправить'
  } finally {
    pending[k] = false
  }
}

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '-' : n.toLocaleString('ru-RU'))

const FIELD_LABEL: Record<string, string> = {
  ichimlikSuviManbaa: 'Источник питьевой воды',
  elektrKunDavomida: 'Электроснабжение',
  internet: 'Интернет',
  oshhonaHolati: 'Столовая',
  aktivZalHolati: 'Актовый зал',
  sportZalHolati: 'Спортзал',
  binoIchidaSuv: 'Вода в здании',
  repairStatus: 'Категория ремонта',
}
const fieldLabel = (f: string) => FIELD_LABEL[f] ?? f

const COMPONENT_LABEL: Record<string, string> = {
  staleness: 'давность записи',
  contradiction: 'противоречия в записи',
  emptiness: 'незаполненность',
  neighbourDeviation: 'отклонение от соседей',
}
const componentLabel = (c: string) => COMPONENT_LABEL[c] ?? c
</script>
