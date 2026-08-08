<template>
  <div class="h-[calc(100vh-4rem)] relative">
    <!-- Controls -->
    <div class="absolute top-3 left-3 z-[500] flex flex-wrap items-center gap-2">
      <select
        v-model.number="regionCode"
        class="control shadow-panel"
      >
        <option :value="0">Вся страна</option>
        <option v-for="r in regions" :key="r.code" :value="r.code">{{ regionName(r) }}</option>
      </select>

      <button
        type="button"
        class="rounded-control border px-3 py-2 text-body font-medium shadow-panel transition-colors"
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
          class="control shadow-panel"
        >
          <option value="composite">Композитная оценка</option>
          <option value="deprivation">Индекс депривации</option>
        </select>

        <!-- Deprivation is computed per facility type and the dimension sets differ,
             so the type is part of the metric rather than a filter over one result. -->
        <select
          v-if="metric === 'deprivation'"
          v-model="objectType"
          class="control shadow-panel"
        >
          <option value="school">Школы</option>
          <option value="kindergarten">Детские сады</option>
          <option value="health_post">ФАП и СВП</option>
        </select>

        <button
          v-if="metric === 'deprivation'"
          type="button"
          class="rounded-control border border-rule bg-paper-raised px-3 py-2 text-body font-medium shadow-panel transition-colors hover:bg-paper-sunk dark:border-night-rule dark:bg-night-raised dark:hover:bg-night-sunk"
          :title="boundHint"
          @click="deprivationBound = deprivationBound === 'lower' ? 'upper' : 'lower'"
        >
          {{ deprivationBound === 'lower' ? 'Нижняя граница' : 'Верхняя граница' }}
        </button>
      </template>
    </div>

    <!-- Legend. Only for the deprivation layer: the composite score already reads
         as a school grade, M0 does not, and its direction is the opposite. -->
    <div
      v-if="showChoropleth && metric === 'deprivation'"
      class="panel absolute bottom-6 left-3 z-[500] px-3 py-2.5"
    >
      <div class="eyebrow mb-1.5">M0, выше = хуже</div>
      <div class="flex items-center gap-1">
        <span v-for="c in legend" :key="c" class="h-2.5 w-7 rounded-sm" :style="{ background: c }" />
      </div>
      <div class="mt-1 flex justify-between text-label text-ink-faint">
        <span>0</span><span>0,5+</span>
      </div>
      <div class="mt-2 flex items-center gap-1.5 text-label text-ink-faint">
        <span class="h-2.5 w-3 rounded-sm" :style="{ background: scale.SCALE_COLORS.none }" />
        объектов недостаточно для оценки
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
        <div class="w-full h-full flex items-center justify-center text-slate-400">Загрузка карты…</div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
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

// Object detail (popup "Подробнее" -> detail view) is open question ОВ №6; left as a hook.
const onObjectClick = (_o: ObjectMarker) => {}
</script>
