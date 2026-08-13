<template>
  <!-- Высота считается от dvh, а не от vh. На телефоне адресная строка браузера
       то сворачивается, то разворачивается, и 100vh - это её развёрнутое
       состояние: карта оказывалась выше видимой области, а нижняя легенда
       уезжала под край экрана. Единица vh оставлена первой строкой как запасная
       для браузеров, не знающих dvh. -->
  <div class="relative h-[calc(100vh-4rem)] h-[calc(100dvh-4rem)]">
    <!-- Controls.

         На телефоне пять элементов управления с переносом занимали пять строк -
         около 220 px поверх карты, то есть треть экрана закрывала то, ради чего
         страница открыта. Поэтому на узком экране они убраны под кнопку и
         раскрываются панелью; с sm остаётся прежняя строка. Кнопка показывает
         число включённых слоёв, чтобы свёрнутое состояние не скрывало факт
         фильтрации. -->
    <button
      type="button"
      class="panel absolute left-3 top-3 z-[500] inline-flex items-center gap-2 px-3 py-2 text-body font-medium text-ink dark:text-paper sm:hidden"
      :aria-expanded="controlsOpen"
      @click="controlsOpen = !controlsOpen"
    >
      <SlidersHorizontal :size="16" />
      Слои
      <span v-if="showChoropleth" class="rounded-full bg-prussian-600 px-1.5 text-label text-paper">1</span>
      <ChevronDown :size="14" :class="controlsOpen ? 'rotate-180' : ''" />
    </button>

    <div
      class="absolute left-3 right-3 top-3 z-[500] flex-wrap items-center gap-2 sm:right-auto sm:flex"
      :class="controlsOpen ? 'mt-12 flex sm:mt-0' : 'hidden'"
    >
      <select
        v-model.number="regionCode"
        class="control w-full shadow-panel sm:w-auto"
      >
        <option :value="0">Вся страна</option>
        <option v-for="r in regions" :key="r.code" :value="r.code">{{ regionName(r) }}</option>
      </select>

      <button
        type="button"
        class="w-full rounded-control border px-3 py-2 text-body font-medium shadow-panel transition-colors sm:w-auto"
        :class="showChoropleth
          ? 'border-prussian-600 bg-prussian-600 text-paper'
          : 'border-rule bg-paper-raised text-ink-muted hover:bg-paper-sunk dark:border-night-rule dark:bg-night-raised dark:text-ink-faint dark:hover:bg-night-sunk'"
        @click="showChoropleth = !showChoropleth"
      >
        Слой по районам
      </button>

      <template v-if="showChoropleth">
        <select
          v-model="metric"
          class="control w-full shadow-panel sm:w-auto"
        >
          <option value="composite">Композитная оценка</option>
          <option value="deprivation">Индекс депривации</option>
        </select>

        <!-- Deprivation is computed per facility type and the dimension sets differ,
             so the type is part of the metric rather than a filter over one result. -->
        <select
          v-if="metric === 'deprivation'"
          v-model="objectType"
          class="control w-full shadow-panel sm:w-auto"
        >
          <option value="school">Школы</option>
          <option value="kindergarten">Детские сады</option>
          <option value="health_post">ФАП и СВП</option>
        </select>

        <button
          v-if="metric === 'deprivation'"
          type="button"
          class="w-full rounded-control border border-rule bg-paper-raised px-3 py-2 text-body font-medium shadow-panel transition-colors hover:bg-paper-sunk dark:border-night-rule dark:bg-night-raised dark:hover:bg-night-sunk sm:w-auto"
          :title="boundHint"
          @click="deprivationBound = deprivationBound === 'lower' ? 'upper' : 'lower'"
        >
          {{ deprivationBound === 'lower' ? 'Нижняя граница' : 'Верхняя граница' }}
        </button>
      </template>
    </div>

    <!-- Legend. Only for the deprivation layer: the composite score already reads
         as a school grade, M0 does not, and its direction is the opposite. -->
    <!-- Легенда занимает нижний левый угол. На телефоне это заметная доля карты,
         поэтому подписи под шкалой сворачиваются нажатием, а сама шкала остаётся
         видимой всегда: без неё цвета на карте ничего не значат. -->
    <div
      v-if="showChoropleth && metric === 'deprivation'"
      class="panel absolute bottom-6 left-3 z-[500] max-w-[calc(100%-1.5rem)] px-3 py-2.5"
    >
      <button
        type="button"
        class="mb-1.5 flex w-full items-center gap-1.5 text-left sm:pointer-events-none"
        @click="legendOpen = !legendOpen"
      >
        <span class="eyebrow">M0, выше = хуже</span>
        <ChevronDown :size="12" class="text-ink-faint sm:hidden" :class="legendOpen ? 'rotate-180' : ''" />
      </button>
      <div class="flex items-center gap-1">
        <span v-for="c in legend" :key="c" class="h-2.5 w-7 rounded-sm" :style="{ background: c }" />
      </div>
      <div class="mt-1 flex justify-between text-label text-ink-faint">
        <span>0</span><span>0,5+</span>
      </div>
      <div v-if="legendOpen" class="mt-2 flex items-center gap-1.5 text-label text-ink-faint">
        <span class="h-2.5 w-3 shrink-0 rounded-sm" :style="{ background: scale.SCALE_COLORS.none }" />
        объектов недостаточно для оценки
      </div>
      <!-- Отдельная строка, а не тот же серый: район без единого загруженного
           объекта и район ниже порога публикации говорят разное. -->
      <div v-if="legendOpen" class="mt-1 flex items-center gap-1.5 text-label text-ink-faint">
        <span class="h-2.5 w-3 shrink-0 rounded-sm" :style="{ background: scale.SCALE_COLORS.absent }" />
        объектов не загружено
      </div>
    </div>

    <ClientOnly>
      <MapCanvas
        :show-choropleth="showChoropleth"
        :metric="metric"
        :object-type="objectType"
        :deprivation-bound="deprivationBound"
        :selected-region-code="regionCode || null"
        @object-click="onObjectClick"
      />
      <template #fallback>
        <div class="flex h-full w-full items-center justify-center text-body text-ink-faint">Загрузка карты…</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { SlidersHorizontal, ChevronDown } from 'lucide-vue-next'
import type { RegionListItem, ObjectMarker } from '~/types'

// Client-only route (ssr:false in nuxt.config) - Leaflet needs window.
definePageMeta({
  layout: 'app',
  pageTitle: 'Карта',
  pageSubtitle: 'Объекты и оценки районов',
})
useSeoMeta({ title: 'Карта - Y.Map' })

const { $api } = useNuxtApp()
const regions = ref<RegionListItem[]>([])
const regionCode = ref(0)
const showChoropleth = ref(false)
const metric = ref('composite')
const objectType = ref('school')
// The index is published as an interval because the year of the last capital
// repair is absent for part of the stock. Which end colours the map is the
// reader's choice and is never averaged away into a midpoint.
const deprivationBound = ref<'lower' | 'upper'>('lower')

// Только для узкого экрана: с sm панель и легенда раскрыты разметкой, и эти
// значения на них не влияют.
const controlsOpen = ref(false)
const legendOpen = ref(true)

const boundHint =
  'Год капитального ремонта записан не у всех объектов. Нижняя граница считает такие записи неотремонтированными, верхняя - отремонтированными.'

// Same ladder as the layer itself and as every table, from useScale.
const scale = useScale()
const legend = scale.legend

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: RegionListItem[] }>('/regions')
    regions.value = res.data
  } catch {
    regions.value = []
  }
})

const regionName = (r: RegionListItem) => {
  const n = r.name as { ru?: string; uz?: string; en?: string } | string
  if (typeof n === 'string') return n
  return n?.ru || n?.uz || n?.en || `Регион ${r.code}`
}

// ОВ №6 closed: the marker opens the facility card. The map answers "where" and
// the card answers "on what basis", and until this route existed a click on a
// point had nowhere to go.
const onObjectClick = (o: ObjectMarker) => navigateTo(`/objects/${o.id}`)
</script>
