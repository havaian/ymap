<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(0,17rem)]">
    <div>
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <button
          v-for="t in TYPES"
          :key="t.value"
          type="button"
          class="rounded-control border px-3 py-1.5 text-label transition-colors"
          :class="objectType === t.value
            ? 'border-prussian-300 bg-prussian-200/15 text-prussian-50'
            : 'border-prussian-200/25 text-prussian-100/70 hover:bg-prussian-200/10'"
          @click="objectType = t.value"
        >
          {{ t.label }}
        </button>
        <span class="ml-auto text-label text-prussian-200/50">M0, выше = хуже</span>
      </div>

      <div
        ref="wrap"
        class="relative aspect-[16/9] w-full overflow-hidden rounded-panel border border-prussian-200/20 bg-prussian-900/40"
      >
        <canvas
          ref="cv"
          class="block h-full w-full"
          @mousemove="onMove"
          @mouseleave="hover = null"
        />
        <p
          v-if="state !== 'ready'"
          class="absolute inset-0 flex items-center justify-center px-6 text-center text-body text-prussian-100/60"
        >
          {{ stateText }}
        </p>
      </div>

      <div class="mt-3 flex items-center gap-1.5">
        <span v-for="c in legend" :key="c" class="h-2 w-8 rounded-sm" :style="{ background: c }" />
        <span class="ml-2 text-label text-prussian-200/50">0 → 0,5+</span>
        <span class="ml-auto flex items-center gap-1.5 text-label text-prussian-200/50">
          <span class="h-2 w-4 rounded-sm" :style="{ background: SCALE_COLORS.none }" />
          мало объектов для оценки
        </span>
      </div>
    </div>

    <!-- The breakdown is the whole point of putting the map here. A composite is
         never shown without the dimensions it was assembled from: a district can
         reach the same M0 from a roof problem or from a shift problem, and those
         are different decisions. -->
    <div class="panel-quiet border-prussian-200/20 bg-prussian-900/30 p-4">
      <template v-if="hover">
        <p class="eyebrow text-prussian-200/70">{{ regionOf(hover) }}</p>
        <p class="mt-1 font-display text-h3 font-semibold text-prussian-50">{{ nameOf(hover) }}</p>

        <template v-if="hover.value !== null">
          <p class="mt-3 font-mono text-figure leading-none text-prussian-50">
            {{ boundText(hover.M0) }}
          </p>
          <p class="mt-1 text-label text-prussian-200/60">
            оценено {{ hover.assessed }}, вне оценки {{ hover.notAssessable }}
          </p>

          <ul class="mt-4 space-y-2">
            <li v-for="d in dimensionsOf(hover)" :key="d.label">
              <div class="flex items-baseline justify-between gap-3">
                <span class="text-note text-prussian-100/80">{{ d.label }}</span>
                <span class="font-mono text-note text-prussian-50">{{ pct(d.lower) }}</span>
              </div>
              <div class="span-track mt-1 bg-prussian-900/60">
                <span class="span-upper" :style="{ width: pctWidth(d.upper), background: SCALE_COLORS.mild }" />
                <span class="span-lower" :style="{ width: pctWidth(d.lower), background: scale.deficiency(d.lower) }" />
              </div>
            </li>
          </ul>
        </template>

        <p v-else class="mt-3 text-body text-prussian-100/70">
          Объектов в районе меньше порога. Доля по такой выборке не публикуется.
        </p>
      </template>

      <template v-else>
        <p class="eyebrow text-prussian-200/70">Индекс депривации</p>
        <p class="mt-2 text-body text-prussian-100/70">
          Наведите курсор на район. Композит раскладывается по измерениям, из которых он собран,
          вместе со знаменателем.
        </p>
        <p class="mt-4 text-label text-prussian-200/50">
          Метод Алкире-Фостера. Полная версия - в разделе «Депривация».
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The landing choropleth.
 *
 * Deliberately not Leaflet. There are no tiles, no zoom, no pan and no
 * interaction with a basemap here - the only thing on screen is the district layer
 * itself. Pulling in a mapping engine and a tile provider for that would put a
 * second copy of the map stack on the marketing page, and the hero already has a
 * canvas. This is one canvas, one fetch and a point-in-polygon test.
 *
 * Hit testing walks the features in reverse and stops at the first ring that
 * contains the cursor, with a bounding-box reject in front of the ray cast. At 163
 * districts that is fast enough to run straight off mousemove without throttling.
 */
const { $api } = useNuxtApp()
const scale = useScale()
const SCALE_COLORS = scale.SCALE_COLORS
const legend = scale.legend

const TYPES = [
  { value: 'school', label: 'Школы' },
  { value: 'kindergarten', label: 'Детские сады' },
  { value: 'health_post', label: 'ФАП и СВП' },
]

const wrap = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const objectType = ref('school')
const hover = ref<any>(null)
const state = ref<'loading' | 'empty' | 'ready'>('loading')

const stateText = computed(() =>
  state.value === 'loading'
    ? 'Загрузка слоя…'
    : 'Слой районов пуст. Границы ещё не загружены в базу.',
)

let features: any[] = []
let bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
let ro: ResizeObserver | null = null
let abort: AbortController | null = null

// ── geometry helpers ─────────────────────────────────────────────────────────

const ringsOf = (geom: any): number[][][] => {
  if (!geom) return []
  if (geom.type === 'Polygon') return [geom.coordinates]
  if (geom.type === 'MultiPolygon') return geom.coordinates
  return []
}

const computeBbox = () => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const f of features) {
    for (const poly of ringsOf(f.geometry)) {
      for (const [x, y] of poly[0] ?? []) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  bbox = { minX, minY, maxX, maxY }
}

// Same cos(lat) correction as the hero: without it the country is a third too wide
// and stops being recognisable as itself.
const projector = (w: number, h: number) => {
  const midLat = ((bbox.minY + bbox.maxY) / 2) * (Math.PI / 180)
  const k = Math.cos(midLat)
  const spanX = (bbox.maxX - bbox.minX) * k
  const spanY = bbox.maxY - bbox.minY
  const s = Math.min(w / spanX, h / spanY) * 0.96
  const cx = w / 2
  const cy = h / 2
  return (lon: number, lat: number) => [
    cx + (lon - (bbox.minX + bbox.maxX) / 2) * k * s,
    cy - (lat - (bbox.minY + bbox.maxY) / 2) * s,
  ] as [number, number]
}

const pointInRing = (x: number, y: number, ring: number[][]) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// ── draw ─────────────────────────────────────────────────────────────────────

const draw = () => {
  const c = cv.value
  const el = wrap.value
  if (!c || !el || !features.length) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = el.clientWidth
  const h = el.clientHeight
  if (!w || !h) return
  if (c.width !== w * dpr || c.height !== h * dpr) {
    c.width = w * dpr
    c.height = h * dpr
  }
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const p = projector(w, h)
  ctx.lineJoin = 'round'

  for (const f of features) {
    const isHover = hover.value === f.properties
    ctx.beginPath()
    for (const poly of ringsOf(f.geometry)) {
      for (const ring of poly) {
        ring.forEach(([lon, lat]: number[], i: number) => {
          const [x, y] = p(lon, lat)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
      }
    }
    const v = f.properties.value
    ctx.fillStyle = scale.deficiency(v)
    ctx.globalAlpha = v === null ? 0.25 : isHover ? 0.95 : 0.7
    ctx.fill('evenodd')
    ctx.globalAlpha = 1
    ctx.strokeStyle = isHover ? '#EDF3F7' : 'rgba(237,243,247,0.25)'
    ctx.lineWidth = isHover ? 1.6 : 0.6
    ctx.stroke()
  }
}

// ── interaction ──────────────────────────────────────────────────────────────

const onMove = (e: MouseEvent) => {
  const el = wrap.value
  const c = cv.value
  if (!el || !c || !features.length) return
  const rect = c.getBoundingClientRect()
  const w = el.clientWidth
  const h = el.clientHeight
  const p = projector(w, h)
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top

  // The cursor is in screen space and the rings are in degrees, so the test runs
  // in screen space: every ring is projected once per check. Cheap at this size,
  // and it avoids inverting the projection.
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i]
    for (const poly of ringsOf(f.geometry)) {
      const outer = poly[0]
      if (!outer?.length) continue
      const projectedRing = outer.map(([lon, lat]: number[]) => p(lon, lat))
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [x, y] of projectedRing) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      if (mx < minX || mx > maxX || my < minY || my > maxY) continue
      if (pointInRing(mx, my, projectedRing)) {
        if (hover.value !== f.properties) {
          hover.value = f.properties
          draw()
        }
        return
      }
    }
  }
  if (hover.value !== null) {
    hover.value = null
    draw()
  }
}

// ── formatting ───────────────────────────────────────────────────────────────

const nameOf = (p: any) => p?.name?.ru || p?.name?.uz || p?.name?.en || '-'
const regionOf = (p: any) => `СОАТО ${p?.districtCode ?? p?.regionCode ?? '-'}`
const pct = (x: number | null) => (x === null || x === undefined ? '-' : `${(x * 100).toFixed(1)} %`)
const pctWidth = (x: number | null) => `${Math.min(100, Math.max(0, (x ?? 0) * 100))}%`
const boundText = (b: { lower: number | null; upper: number | null }) =>
  b?.lower === b?.upper ? String(b?.lower ?? '-') : `${b?.lower ?? '-'} – ${b?.upper ?? '-'}`

const dimensionsOf = (p: any) => {
  const dims = Object.values(p?.dimensions ?? {}) as { label: string; lower: number | null; upper: number | null }[]
  return [...dims].sort((a, b) => (b.lower ?? 0) - (a.lower ?? 0))
}

// ── load ─────────────────────────────────────────────────────────────────────

const load = async () => {
  abort?.abort()
  const controller = new AbortController()
  abort = controller
  state.value = 'loading'
  hover.value = null
  try {
    const res = await $api<any>('/analytics/deprivation/choropleth', {
      query: { objectType: objectType.value, bound: 'lower' },
      signal: controller.signal,
    })
    if (controller.signal.aborted) return
    const gj = res?.type === 'FeatureCollection' ? res : res?.data
    features = (gj?.features ?? []).filter((f: any) => f.geometry)
    if (!features.length) {
      state.value = 'empty'
      return
    }
    computeBbox()
    state.value = 'ready'
    await nextTick()
    draw()
  } catch {
    features = []
    state.value = 'empty'
  } finally {
    if (abort === controller) abort = null
  }
}

watch(objectType, load)

onMounted(() => {
  load()
  ro = new ResizeObserver(() => draw())
  if (wrap.value) ro.observe(wrap.value)
})

onBeforeUnmount(() => {
  abort?.abort()
  ro?.disconnect()
})
</script>
