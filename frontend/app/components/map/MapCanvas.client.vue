<template>
  <div class="relative w-full h-full">
    <div ref="mapEl" class="w-full h-full" />
    <div
      v-if="loading"
      class="panel absolute top-3 right-3 z-[500] flex items-center gap-2 px-3 py-1.5 text-label text-ink-muted dark:text-ink-faint"
    >
      <span class="h-2.5 w-2.5 rounded-full border-2 border-prussian-500 border-t-transparent animate-spin" />
      Загрузка…
    </div>
    <div
      v-if="truncated"
      class="panel absolute top-14 right-3 z-[500] px-3 py-1.5 text-label text-ink-muted dark:text-ink-faint"
    >
      Показана часть объектов: {{ shown.toLocaleString('ru-RU') }} из {{ available.toLocaleString('ru-RU') }}. Приблизьте карту
    </div>
  </div>
</template>

<script setup lang="ts">
// Ported from frontend/src/components/map/MapComponent.tsx (+ ChoroplethLayer /
// RegionBorderLayer). Trimmed per business ТЗ 4.3: keeps objects (clustered) + district
// scoring (choropleth) + region borders; drops the issue layer, heatmap, layer toggles
// and the mode switch. Object markers carry no verification ring / unresolved badge -
// the /markers/objects endpoint returns no such counts yet (ОВ №5).
//
// REWORKED for frame budget. Four things cost the most and none of them was the
// network:
//
//   1. Every `moveend` cleared the cluster group and rebuilt every marker from
//      scratch. Panning one screen width re-created hundreds of DOM nodes that had
//      not moved. Markers are diffed by id now: only what entered the viewport is
//      built, only what left is removed.
//   2. `bindPopup` ran per marker, so a popup instance and its HTML string existed
//      for every point on screen whether or not it was ever opened. There is one
//      popup now, filled on hover.
//   3. The choropleth drew through Leaflet's default SVG renderer. A district
//      outline at source resolution is thousands of vertices, and 163 of them put
//      the whole country into the SVG DOM. It draws on canvas now, and the server
//      ships the simplified copy written by simplify-boundaries.js.
//   4. Selecting a region fired /analytics/choropleth a second time with identical
//      arguments, purely to draw the inner district grid, and left two heavy
//      layers alive at once. The grid is derived from the layer already loaded.
//
// Requests carry an AbortController: dragging across the country used to leave a
// queue of superseded responses that each still rebuilt the layer on arrival.
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
const truncated = ref(false)
const shown = ref(0)
const available = ref(0)

let map: L.Map | null = null
let tileLayer: L.TileLayer | null = null
// markerClusterGroup is added to L by the leaflet.markercluster side-effect import.
let cluster: L.LayerGroup | null = null
let choroplethLayer: L.GeoJSON | null = null
let regionOuter: L.GeoJSON | null = null
let regionInner: L.GeoJSON | null = null
let fetchTimer: ReturnType<typeof setTimeout> | null = null
let objectsAbort: AbortController | null = null
let choroplethAbort: AbortController | null = null
// One renderer instance for every vector layer on the map. Leaflet creates a
// separate canvas per layer otherwise, and each one is a full-viewport surface.
let vectorRenderer: L.Canvas | null = null
// Markers currently on the map, keyed by object id. This is what turns a rebuild
// into a diff.
const live = new Map<string, L.Marker>()
// Last GeoJSON the choropleth loaded, reused for the inner district grid instead
// of asking the server for the same bytes twice.
let lastChoroplethGeoJSON: any = null
let hoverPopup: L.Popup | null = null

// ── palette ───────────────────────────────────────────────────────────────────
//
// The literals here used to be Tailwind defaults (indigo, violet, cyan) left over
// from the template look. They are cyanotype tokens now, so a marker, a district
// fill and a table cell on the same screen belong to one system. Facility type is
// carried by three steps of the accent; state, where there is one, comes off the
// semantic ramp, which is the only thing the ramp is for.

const TYPE_COLOR: Record<string, string> = {
  school: '#14415C', // prussian-600
  kindergarten: '#4A7F9F', // prussian-400
  health_post: '#2A6082', // prussian-500
}
const ACCENT = '#14415C'
const OVERCROWDED = '#B5622A' // scale.poor
const PAPER = '#FFFFFF'

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c))

const objectTypeColor = (t: string): string => TYPE_COLOR[t] ?? ACCENT

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

// The marker was 40 px with a coloured box-shadow. A shadow is a blur pass per
// element per frame, and with a few hundred markers that alone stalls a pan. Size
// is down to 30, the shadow is gone, and the shape reads from the border instead.
const ICON_SIZE = 30

const createObjectIcon = (o: ObjectMarker): L.DivIcon => {
  const overcrowded = (o.capacity ?? 0) > 0 && (o.enrollment ?? 0) > (o.capacity ?? 0)
  const color = overcrowded ? OVERCROWDED : objectTypeColor(o.objectType)
  // A coordinate reused across several facilities in the source registry is a
  // valid point and an unknown position. It gets a dashed outline so it never
  // reads as a surveyed location: in the non-state preschool registry 640
  // coordinates carry 1441 objects, one of them thirty at once.
  const border = o.coordShared ? `2px dashed ${PAPER}` : `2px solid ${PAPER}`
  const html = `<div style="background-color:${color};width:${ICON_SIZE}px;height:${ICON_SIZE}px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:${border};">${typeSvg(o.objectType, PAPER, 15)}</div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
  })
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
    ? '<div style="margin-top:6px;font-size:11px;color:#B5622A;">Координата общая для нескольких объектов, положение требует полевого уточнения</div>'
    : ''
  return `<div style="padding:12px;min-width:200px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <span style="display:inline-flex;padding:6px;background:#EDF3F7;border-radius:8px;">${typeSvg(o.objectType, ACCENT, 16)}</span>
      <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.14em;color:#8E979F;">${escapeHtml(label)}</span>
    </div>
    <div style="font-weight:600;color:#12181D;font-size:15px;line-height:1.2;margin-bottom:8px;">${escapeHtml(o.name)}</div>
    <div style="font-size:11px;color:#8E979F;">Источник координаты: ${escapeHtml(origin)}</div>${sharedNote}
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
  const color = count >= 100 ? '#0A2534' : count >= 50 ? '#0E3247' : ACCENT
  const size = count >= 100 ? 44 : count >= 50 ? 40 : 34
  const html = `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:${PAPER};font-weight:600;font-variant-numeric:tabular-nums;font-size:${size > 38 ? '15px' : '13px'};border:2px solid ${PAPER};">${count}</div>`
  return L.divIcon({ html, className: '', iconSize: L.point(size, size) })
}

// ── tiles ─────────────────────────────────────────────────────────────────────

const setTile = () => {
  if (!map) return
  const dark = document.documentElement.classList.contains('dark')
  const url = dark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
  const next = L.tileLayer(url, {
    subdomains: 'abcd',
    maxZoom: 20,
    // Tiles outside the viewport are kept for one screen in each direction. The
    // default of 2 holds four times the area in memory for a pan that usually
    // does not happen.
    keepBuffer: 1,
    updateWhenIdle: true,
    updateWhenZooming: false,
  })
  next.addTo(map)
  // The old layer goes only once the new one exists, otherwise the basemap blinks
  // white on every theme switch.
  if (tileLayer) map.removeLayer(tileLayer)
  tileLayer = next
}

// ── objects (viewport bbox fetch, diffed) ─────────────────────────────────────

const fetchObjects = async () => {
  if (!map || !cluster) return
  objectsAbort?.abort()
  const controller = new AbortController()
  objectsAbort = controller

  const b = map.getBounds()
  loading.value = true
  try {
    const res = await $api<{
      success: boolean
      data: ObjectMarker[]
      total?: number
      truncated?: boolean
    }>('/markers/objects', {
      query: {
        swLat: b.getSouth(),
        swLng: b.getWest(),
        neLat: b.getNorth(),
        neLng: b.getEast(),
      },
      signal: controller.signal,
    })
    if (controller.signal.aborted) return

    const group = cluster as unknown as {
      addLayers: (m: L.Layer[]) => void
      removeLayers: (m: L.Layer[]) => void
    }

    // /markers/objects returns coordPrecision 'exact' only, so this filter should
    // never remove anything. It stays because a marker built from a null pair is
    // placed at [0, 0] in the Gulf of Guinea rather than failing, which is the
    // hardest kind of wrong position to notice.
    const incoming = res.data.filter(
      (o) => typeof o.lat === 'number' && typeof o.lng === 'number',
    )
    const incomingIds = new Set(incoming.map((o) => o.id))

    const toAdd: L.Layer[] = []
    for (const o of incoming) {
      if (live.has(o.id)) continue
      const m = L.marker([o.lat, o.lng], { icon: createObjectIcon(o) })
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e)
        emit('objectClick', o)
      })
      // One popup for the whole map, opened on hover at the marker's position.
      // Binding a popup per marker meant an object and an HTML string per point
      // whether or not anyone ever looked at it.
      m.on('mouseover', () => openHoverPopup(o))
      m.on('mouseout', () => closeHoverPopup())
      live.set(o.id, m)
      toAdd.push(m)
    }

    const toRemove: L.Layer[] = []
    for (const [id, marker] of live) {
      if (incomingIds.has(id)) continue
      toRemove.push(marker)
      live.delete(id)
    }

    if (toRemove.length) group.removeLayers(toRemove)
    if (toAdd.length) group.addLayers(toAdd)

    shown.value = incoming.length
    available.value = res.total ?? incoming.length
    truncated.value = !!res.truncated
  } catch {
    /* non-critical - keep existing markers */
  } finally {
    if (objectsAbort === controller) {
      objectsAbort = null
      loading.value = false
    }
  }
}

const openHoverPopup = (o: ObjectMarker) => {
  if (!map) return
  if (!hoverPopup) {
    hoverPopup = L.popup({
      closeButton: false,
      offset: [0, -6],
      className: 'object-popup',
      autoPan: false,
    })
  }
  hoverPopup.setLatLng([o.lat, o.lng]).setContent(popupHtml(o)).openOn(map)
}

const closeHoverPopup = () => {
  if (map && hoverPopup) map.closePopup(hoverPopup)
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
  return `<div style="font-size:12px;"><strong>${escapeHtml(districtName(p))}</strong><br/><span style="font-size:18px;font-weight:600;color:${scoreColor(v)}">${v}</span><span style="font-size:11px;color:#8E979F;"> / 100</span></div>`
}

// Tooltip for M0. Carries the denominator and the interval, because a district
// rate without the count behind it invites a comparison the sample cannot support.
const deprivationTooltip = (p: any): string => {
  const v = p?.value ?? null
  if (v === null) {
    // Два разных серых состояния. no_objects - в районе нет ни одного объекта
    // этого типа, это про покрытие загрузки. Иначе объекты есть, но их меньше
    // порога публикации.
    const note = p?.status === 'no_objects'
      ? 'объектов этого типа не загружено'
      : `объектов недостаточно для оценки (${p?.assessed ?? 0})`
    return `<div style="font-size:12px;"><strong>${escapeHtml(districtName(p))}</strong><br/><span style="color:#8E979F;">${note}</span></div>`
  }
  const dims = Object.values(p?.dimensions ?? {}) as { label: string; lower: number | null }[]
  const worst = [...dims].sort((a, b) => (b.lower ?? 0) - (a.lower ?? 0)).slice(0, 3)
  const rows = worst
    .map((d) => `<div style="display:flex;justify-content:space-between;gap:12px;"><span>${escapeHtml(d.label)}</span><span style="font-weight:600;">${pctText(d.lower)}</span></div>`)
    .join('')
  return `<div style="font-size:12px;min-width:190px;">
    <strong>${escapeHtml(districtName(p))}</strong><br/>
    <span style="font-size:18px;font-weight:600;color:${deprivationColor(v)}">${boundText(p.M0)}</span>
    <span style="font-size:11px;color:#8E979F;"> M0, выше = хуже</span>
    <div style="font-size:11px;color:#8E979F;margin:4px 0 6px;">оценено ${p.assessed}, вне оценки ${p.notAssessable}</div>
    ${rows}
  </div>`
}

const renderChoropleth = async () => {
  if (!map) return
  choroplethAbort?.abort()
  if (choroplethLayer) {
    map.removeLayer(choroplethLayer)
    choroplethLayer = null
  }
  if (!props.showChoropleth) {
    // The cached GeoJSON goes with the layer: keeping it would let a stale metric
    // feed the inner grid after the layer itself was turned off.
    lastChoroplethGeoJSON = null
    renderInnerGrid()
    return
  }
  const isDeprivation = props.metric === 'deprivation'
  const controller = new AbortController()
  choroplethAbort = controller
  try {
    const query: Record<string, string | number> = isDeprivation
      ? { objectType: props.objectType, bound: props.deprivationBound }
      : { metric: props.metric }
    if (props.selectedRegionCode != null) query.regionCode = props.selectedRegionCode
    const url = isDeprivation ? '/analytics/deprivation/choropleth' : '/analytics/choropleth'
    const res = await $api<any>(url, { query, signal: controller.signal })
    if (controller.signal.aborted || !map) return
    const gj = res?.type === 'FeatureCollection' ? res : res?.data
    if (!gj?.features?.length) return
    lastChoroplethGeoJSON = gj
    const layer = L.geoJSON(gj, {
      // Canvas instead of SVG. This is the single largest win on this screen:
      // district outlines are thousands of vertices each and the SVG renderer puts
      // every one of them in the document.
      renderer: vectorRenderer ?? undefined,
      // Leaflet's own screen-space simplification on top of the server's. At the
      // zoom a district layer is read at, 1.5 px of tolerance is not visible.
      smoothFactor: 1.5,
      style: (f: any) => ({
        fillColor: isDeprivation
          ? f.properties.status === 'no_objects'
            ? scale.SCALE_COLORS.absent
            : deprivationColor(f.properties.value ?? null)
          : scoreColor(f.properties.value ?? 0),
        weight: 1,
        opacity: 0.8,
        color: '#5A6570',
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
          t.setStyle({ weight: 2.5, color: '#14415C', fillOpacity: 0.7 })
        })
        lyr.on('mouseout', (e) => {
          if (choroplethLayer) choroplethLayer.resetStyle(e.target as L.Path)
        })
      },
    })
    layer.addTo(map)
    layer.bringToBack()
    choroplethLayer = layer
    renderInnerGrid()
  } catch {
    /* non-critical */
  } finally {
    if (choroplethAbort === controller) choroplethAbort = null
  }
}

// ── region border + inner district grid ──────────────────────────────────────────

// The grid is a hairline outline of the same districts the choropleth already
// holds. It used to be a second request to /analytics/choropleth with identical
// arguments, so the heaviest payload on the page was fetched and parsed twice and
// two layers of it stayed alive. When no choropleth is loaded there is nothing to
// outline, and the region border alone is the correct picture.
const renderInnerGrid = () => {
  if (!map) return
  if (regionInner) {
    map.removeLayer(regionInner)
    regionInner = null
  }
  if (props.selectedRegionCode == null || !lastChoroplethGeoJSON?.features?.length) return
  const layer = L.geoJSON(lastChoroplethGeoJSON, {
    renderer: vectorRenderer ?? undefined,
    smoothFactor: 1.5,
    style: { color: '#4A7F9F', weight: 1, opacity: 0.55, fillOpacity: 0, dashArray: '' },
    interactive: false,
  })
  layer.addTo(map)
  layer.bringToBack()
  regionInner = layer
}

const renderRegion = async (code: number | null) => {
  if (!map) return
  if (regionOuter) {
    map.removeLayer(regionOuter)
    regionOuter = null
  }
  if (code == null) {
    renderInnerGrid()
    return
  }

  try {
    const res = await $api<any>(`/regions/${code}`)
    const geom = res?.data?.geometry
    if (geom && map) {
      const layer = L.geoJSON({ type: 'Feature', properties: {}, geometry: geom } as any, {
        renderer: vectorRenderer ?? undefined,
        smoothFactor: 1.5,
        style: { color: '#14415C', weight: 2, opacity: 1, fillOpacity: 0, dashArray: '10 6' },
        interactive: false,
      })
      layer.addTo(map)
      regionOuter = layer
      const bounds = layer.getBounds()
      if (bounds.isValid()) map.flyToBounds(bounds, { padding: [48, 48], duration: 0.8, maxZoom: 10 })
    }
  } catch {
    /* non-critical */
  }

  renderInnerGrid()
}

// ── lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, {
    center: TASHKENT_CENTER,
    zoom: 13,
    zoomControl: false,
    // Zoom animation on a cluster group re-lays-out every visible marker for the
    // duration of the transition. Panning matters more than the flourish.
    markerZoomAnimation: false,
    preferCanvas: true,
  })
  vectorRenderer = L.canvas({ padding: 0.3 })
  setTile()

  const mcg = (L as unknown as { markerClusterGroup?: (opts: any) => L.LayerGroup }).markerClusterGroup
  if (typeof mcg === 'function') {
    cluster = mcg({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      maxClusterRadius: 60,
      // Cluster split and merge animations run a transition per marker. With a few
      // hundred on screen that is the worst frame on the page.
      animate: false,
      animateAddingMarkers: false,
      // Below this zoom every point sits inside a cluster anyway, so the individual
      // markers never need to exist.
      disableClusteringAtZoom: 15,
      chunkedLoading: true,
      removeOutsideVisibleBounds: true,
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
  objectsAbort?.abort()
  choroplethAbort?.abort()
  live.clear()
  lastChoroplethGeoJSON = null
  if (map) {
    map.off()
    map.remove()
    map = null
  }
})
</script>
