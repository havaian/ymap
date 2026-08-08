<template>
  <div class="relative w-full h-full">
    <div ref="mapEl" class="w-full h-full" />
    <div
      v-if="loading"
      class="absolute top-3 right-3 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/90 shadow text-xs font-bold text-slate-500 dark:text-slate-300"
    >
      <span class="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      Загрузка…
    </div>
  </div>
</template>

<script setup lang="ts">
// Ported from frontend/src/components/map/MapComponent.tsx (+ ChoroplethLayer /
// RegionBorderLayer). Trimmed per business ТЗ 4.3: keeps objects (clustered) + district
// scoring (choropleth) + region borders; drops the issue layer, heatmap, layer toggles
// and the mode switch. Object markers carry no verification ring / unresolved badge -
// the /markers/objects endpoint returns no such counts yet (ОВ №5).
import L from 'leaflet'
import 'leaflet.markercluster'
import type { ObjectMarker } from '~/types'
import { TASHKENT_CENTER } from '~/types/constants'

// metric 'deprivation' reads a different endpoint from the rest. The scoring
// metrics publish 0-100 where higher is better; M0 runs 0-1 where higher is worse
// and carries an interval, so it gets its own fetch, its own colour ramp and its
// own tooltip rather than being squeezed into the score scale.
const props = withDefaults(
  defineProps<{
    showChoropleth?: boolean
    metric?: string
    objectType?: string
    deprivationBound?: 'lower' | 'upper'
    selectedRegionCode?: number | null
  }>(),
  {
    showChoropleth: false,
    metric: 'composite',
    objectType: 'school',
    deprivationBound: 'lower',
    selectedRegionCode: null,
  },
)

const emit = defineEmits<{ objectClick: [ObjectMarker] }>()

const { $api } = useNuxtApp()
const ui = useUiStore()

const mapEl = ref<HTMLElement | null>(null)
const loading = ref(false)

let map: L.Map | null = null
let tileLayer: L.TileLayer | null = null
// markerClusterGroup is added to L by the leaflet.markercluster side-effect import.
let cluster: L.LayerGroup | null = null
let choroplethLayer: L.GeoJSON | null = null
let regionOuter: L.GeoJSON | null = null
let regionInner: L.GeoJSON | null = null
let fetchTimer: ReturnType<typeof setTimeout> | null = null

// ── helpers (ported) ──────────────────────────────────────────────────────────

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c))

const objectTypeColor = (t: string): string =>
  t === 'kindergarten' ? '#7c3aed' : t === 'health_post' ? '#0891b2' : '#4f46e5'

const TYPE_LABEL: Record<string, string> = {
  school: 'Школа',
  kindergarten: 'Детский сад',
  health_post: 'ФАП/СВП',
}

const typeSvg = (type: string, color: string, size = 18): string => {
  const paths: Record<string, string> = {
    school: '<path d="m4 6 8-4 8 4-8 4-8-4Z"/><path d="M4 6v6c0 1.5 3.5 3 8 3s8-1.5 8-3V6"/>',
    health_post: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    default: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/>',
  }
  const p = paths[type] ?? paths.default
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`
}

const createObjectIcon = (o: ObjectMarker): L.DivIcon => {
  const overcrowded = (o.capacity ?? 0) > 0 && (o.enrollment ?? 0) > (o.capacity ?? 0)
  const color = overcrowded ? '#f97316' : objectTypeColor(o.objectType)
  const size = 40
  // A coordinate reused across several facilities in the source registry is a
  // valid point and an unknown position. It gets a dashed outline so it never
  // reads as a surveyed location: in the non-state preschool registry 640
  // coordinates carry 1441 objects, one of them thirty at once.
  const border = o.coordShared ? '2px dashed #ffffff' : '2px solid white'
  const html = `<div style="position:relative;background-color:${color};width:${size}px;height:${size}px;border-radius:12px;display:flex;align-items:center;justify-content:center;border:${border};box-shadow:0 4px 12px -2px ${color}66;">${typeSvg(o.objectType, 'white')}</div>`
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
}

const COORD_SOURCE_LABEL: Record<string, string> = {
  egov_inn: 'реестр data.egov.uz, соединение по ИНН',
  osm: 'OpenStreetMap',
  field_verified: 'полевая проверка',
  manual: 'внесено вручную',
  district_centroid: 'центроид района',
  none: 'координата неизвестна',
}

const popupHtml = (o: ObjectMarker): string => {
  const label = TYPE_LABEL[o.objectType] ?? o.objectType ?? ''
  const origin = COORD_SOURCE_LABEL[o.coordSource ?? 'none'] ?? o.coordSource ?? ''
  const sharedNote = o.coordShared
    ? '<div style="margin-top:6px;font-size:10px;color:#b45309;">Координата общая для нескольких объектов, положение требует полевого уточнения</div>'
    : ''
  return `<div style="padding:12px;min-width:200px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="display:inline-flex;padding:6px;background:#e0e7ff;border-radius:8px;">${typeSvg(o.objectType, '#4f46e5', 16)}</span>
      <span style="font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;">${escapeHtml(label)}</span>
    </div>
    <div style="font-weight:900;color:#0f172a;font-size:15px;line-height:1.2;margin-bottom:8px;">${escapeHtml(o.name)}</div>
    <div style="font-size:10px;color:#94a3b8;">Источник координаты: ${escapeHtml(origin)}</div>${sharedNote}
    <div style="margin-top:8px;display:flex;align-items:center;gap:6px;color:#2563eb;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;">Подробнее →</div>
  </div>`
}

// Both ramps come from useScale. They used to sit here as literals and had already
// drifted from the copies on the analytics pages, so one district could be one
// colour in a table and another on the map.
const scale = useScale()
const scoreColor = (v: number): string => scale.score(v)
const deprivationColor = (v: number | null): string => scale.deficiency(v)

const pctText = (x: number | null): string => (x === null || x === undefined ? '-' : `${(x * 100).toFixed(1)} %`)

// An interval collapses to a single figure when both bounds agree.
const boundText = (b: { lower: number | null; upper: number | null }): string =>
  b.lower === b.upper ? String(b.lower ?? '-') : `${b.lower ?? '-'} – ${b.upper ?? '-'}`

const clusterIcon = (c: { getChildCount: () => number }): L.DivIcon => {
  const count = c.getChildCount()
  const color = count >= 100 ? '#7c3aed' : count >= 50 ? '#6366f1' : '#4f46e5'
  const size = count >= 100 ? 48 : count >= 50 ? 44 : 38
  const html = `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:${size > 40 ? '16px' : '14px'};border:3px solid white;box-shadow:0 4px 15px rgba(79,70,229,.4);">${count}</div>`
  return L.divIcon({ html, className: '', iconSize: L.point(size, size) })
}

// ── tiles ─────────────────────────────────────────────────────────────────────

const setTile = () => {
  if (!map) return
  const dark = document.documentElement.classList.contains('dark')
  const url = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
  if (tileLayer) map.removeLayer(tileLayer)
  tileLayer = L.tileLayer(url, { subdomains: 'abcd', maxZoom: 20 }).addTo(map)
}

// ── objects (viewport bbox fetch) ───────────────────────────────────────────────

const fetchObjects = async () => {
  if (!map || !cluster) return
  const b = map.getBounds()
  loading.value = true
  try {
    const res = await $api<{ success: boolean; data: ObjectMarker[] }>('/markers/objects', {
      query: {
        swLat: b.getSouth(),
        swLng: b.getWest(),
        neLat: b.getNorth(),
        neLng: b.getEast(),
      },
    })
    const group = cluster as unknown as { clearLayers: () => void; addLayers: (m: L.Layer[]) => void }
    group.clearLayers()
    // /markers/objects returns coordPrecision 'exact' only, so this filter should
    // never remove anything. It stays because a marker built from a null pair is
    // placed at [0, 0] in the Gulf of Guinea rather than failing, which is the
    // hardest kind of wrong position to notice.
    const markers = res.data
      .filter((o) => typeof o.lat === 'number' && typeof o.lng === 'number')
      .map((o) => {
        const m = L.marker([o.lat, o.lng], { icon: createObjectIcon(o) })
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          emit('objectClick', o)
        })
        m.bindPopup(popupHtml(o), { closeButton: false, offset: [0, -5], className: 'object-popup' })
        m.on('mouseover', (e) => (e.target as L.Marker).openPopup())
        m.on('mouseout', (e) => (e.target as L.Marker).closePopup())
        return m
      })
    group.addLayers(markers)
  } catch {
    /* non-critical - keep existing markers */
  } finally {
    loading.value = false
  }
}

const scheduleFetch = () => {
  if (fetchTimer) clearTimeout(fetchTimer)
  fetchTimer = setTimeout(fetchObjects, 300)
}

// ── choropleth ──────────────────────────────────────────────────────────────────

const districtName = (p: any): string =>
  p?.name?.ru || p?.name?.uz || p?.name?.en || (typeof p?.name === 'string' ? p.name : '') || '-'

// Tooltip for the score metrics: one number out of a hundred, higher is better.
const scoreTooltip = (p: any): string => {
  const v = p?.value ?? 0
  return `<div style="font-family:system-ui;font-size:12px;"><strong>${escapeHtml(districtName(p))}</strong><br/><span style="font-size:18px;font-weight:900;color:${scoreColor(v)}">${v}</span><span style="font-size:10px;color:#94a3b8;"> / 100</span></div>`
}

// Tooltip for M0. Carries the denominator and the interval, because a district
// rate without the count behind it invites a comparison the sample cannot support.
const deprivationTooltip = (p: any): string => {
  const v = p?.value ?? null
  if (v === null) {
    return `<div style="font-family:system-ui;font-size:12px;"><strong>${escapeHtml(districtName(p))}</strong><br/><span style="color:#94a3b8;">объектов недостаточно для оценки (${p?.assessed ?? 0})</span></div>`
  }
  const dims = Object.values(p?.dimensions ?? {}) as { label: string; lower: number | null }[]
  const worst = [...dims].sort((a, b) => (b.lower ?? 0) - (a.lower ?? 0)).slice(0, 3)
  const rows = worst
    .map((d) => `<div style="display:flex;justify-content:space-between;gap:12px;"><span>${escapeHtml(d.label)}</span><span style="font-weight:700;">${pctText(d.lower)}</span></div>`)
    .join('')
  return `<div style="font-family:system-ui;font-size:12px;min-width:190px;">
    <strong>${escapeHtml(districtName(p))}</strong><br/>
    <span style="font-size:18px;font-weight:900;color:${deprivationColor(v)}">${boundText(p.M0)}</span>
    <span style="font-size:10px;color:#94a3b8;"> M0, выше = хуже</span>
    <div style="font-size:10px;color:#94a3b8;margin:4px 0 6px;">оценено ${p.assessed}, вне оценки ${p.notAssessable}</div>
    ${rows}
  </div>`
}

const renderChoropleth = async () => {
  if (!map) return
  if (choroplethLayer) {
    map.removeLayer(choroplethLayer)
    choroplethLayer = null
  }
  if (!props.showChoropleth) return
  const isDeprivation = props.metric === 'deprivation'
  try {
    const query: Record<string, string | number> = isDeprivation
      ? { objectType: props.objectType, bound: props.deprivationBound }
      : { metric: props.metric }
    if (props.selectedRegionCode != null) query.regionCode = props.selectedRegionCode
    const url = isDeprivation ? '/analytics/deprivation/choropleth' : '/analytics/choropleth'
    const res = await $api<any>(url, { query })
    const gj = res?.type === 'FeatureCollection' ? res : res?.data
    if (!gj?.features?.length) return
    const layer = L.geoJSON(gj, {
      style: (f: any) => ({
        fillColor: isDeprivation
          ? deprivationColor(f.properties.value ?? null)
          : scoreColor(f.properties.value ?? 0),
        weight: 1.5,
        opacity: 0.8,
        color: '#475569',
        // A district held out for too few objects is drawn faint, so it reads as
        // absent rather than as a measured low value.
        fillOpacity: isDeprivation && f.properties.value === null ? 0.2 : 0.5,
      }),
      onEachFeature: (f: any, lyr: L.Layer) => {
        ;(lyr as L.Path).bindTooltip(
          isDeprivation ? deprivationTooltip(f.properties) : scoreTooltip(f.properties),
          { sticky: true, direction: 'top', offset: [0, -10] },
        )
        lyr.on('mouseover', (e) => {
          const t = e.target as L.Path
          t.setStyle({ weight: 3, color: '#3b82f6', fillOpacity: 0.7 })
          t.bringToFront()
        })
        lyr.on('mouseout', (e) => {
          if (choroplethLayer) choroplethLayer.resetStyle(e.target as L.Path)
        })
      },
    })
    layer.addTo(map)
    layer.bringToBack()
    choroplethLayer = layer
  } catch {
    /* non-critical */
  }
}

// ── region border + inner district grid ──────────────────────────────────────────

const renderRegion = async (code: number | null) => {
  if (!map) return
  if (regionOuter) {
    map.removeLayer(regionOuter)
    regionOuter = null
  }
  if (regionInner) {
    map.removeLayer(regionInner)
    regionInner = null
  }
  if (code == null) return

  try {
    const res = await $api<any>(`/regions/${code}`)
    const geom = res?.data?.geometry
    if (geom) {
      const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: geom } as any, {
        style: { color: '#3b82f6', weight: 2.5, opacity: 1, fillOpacity: 0, dashArray: '10 6' },
        interactive: false,
      })
      layer.addTo(map)
      regionOuter = layer
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [48, 48], duration: 1.0, maxZoom: 10 })
    }
  } catch {
    /* non-critical */
  }

  try {
    const res = await $api<any>('/analytics/choropleth', { query: { regionCode: code, metric: 'composite' } })
    const gj = res?.type === 'FeatureCollection' ? res : res?.data
    if (gj?.features?.length) {
      const layer = L.geoJSON(gj, {
        style: { color: '#60a5fa', weight: 1, opacity: 0.55, fillOpacity: 0, dashArray: '' },
        interactive: false,
      })
      layer.addTo(map)
      layer.bringToBack()
      regionInner = layer
    }
  } catch {
    /* non-critical */
  }
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, {
    center: TASHKENT_CENTER,
    zoom: 13,
    zoomControl: false,
    markerZoomAnimation: true,
  })
  setTile()

  const mcg = (L as unknown as { markerClusterGroup?: (opts: any) => L.LayerGroup }).markerClusterGroup
  if (typeof mcg === 'function') {
    cluster = mcg({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      animate: true,
      iconCreateFunction: clusterIcon,
    })
    map.addLayer(cluster)
  }

  map.on('moveend', scheduleFetch)

  await fetchObjects()
  await renderChoropleth()
  if (props.selectedRegionCode != null) await renderRegion(props.selectedRegionCode)
})

watch(() => props.showChoropleth, renderChoropleth)
watch(() => props.metric, renderChoropleth)
// Both only affect the deprivation layer, and renderChoropleth ignores them for
// the score metrics, so no guard is needed here.
watch(() => props.objectType, renderChoropleth)
watch(() => props.deprivationBound, renderChoropleth)
watch(
  () => props.selectedRegionCode,
  (c) => {
    renderRegion(c ?? null)
    renderChoropleth()
  },
)
watch(() => ui.theme, setTile)

onBeforeUnmount(() => {
  if (fetchTimer) clearTimeout(fetchTimer)
  if (map) {
    map.off()
    map.remove()
    map = null
  }
})
</script>
