<template>
  <div class="h-[calc(100vh-4rem)] relative">
    <!-- Controls -->
    <div class="absolute top-3 left-3 z-[500] flex flex-wrap items-center gap-2">
      <select
        v-model.number="regionCode"
        class="px-3 py-2 rounded-xl text-sm font-semibold bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option :value="0">Вся страна</option>
        <option v-for="r in regions" :key="r.code" :value="r.code">{{ regionName(r) }}</option>
      </select>

      <button
        type="button"
        class="px-3 py-2 rounded-xl text-sm font-bold shadow border transition-colors"
        :class="showChoropleth
          ? 'bg-blue-600 text-white border-blue-600'
          : 'bg-white/95 dark:bg-slate-900/95 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'"
        @click="showChoropleth = !showChoropleth"
      >
        Оценки районов
      </button>
    </div>

    <ClientOnly>
      <MapCanvas
        :show-choropleth="showChoropleth"
        metric="composite"
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
