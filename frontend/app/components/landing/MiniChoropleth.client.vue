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
        <!-- touch-action: pan-y - вертикальный скролл страницы над картой
             работает как обычно, горизонтальное перетаскивание двигает слой.
             Колесо не перехватывается вообще: масштаб меняется кнопками. -->
        <canvas
          ref="cv"
          class="block h-full w-full touch-pan-y"
          :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
          @pointerleave="onLeave"
        />

        <!-- Масштаб и сдвиг: есть районы в пару пикселей, без увеличения их не
             навести и не рассмотреть. -->
        <div class="absolute right-3 top-3 flex flex-col gap-1.5">
          <button
            type="button"
            class="zoom-btn"
            aria-label="Приблизить"
            :disabled="zoom >= ZOOM_MAX"
            @click="zoomBy(1.6)"
          >
            <Plus :size="15" />
          </button>
          <button
            type="button"
            class="zoom-btn"
            aria-label="Отдалить"
            :disabled="zoom <= 1"
            @click="zoomBy(1 / 1.6)"
          >
            <Minus :size="15" />
          </button>
          <button
            v-if="zoom > 1 || tx !== 0 || ty !== 0"
            type="button"
            class="zoom-btn"
            aria-label="Сбросить масштаб"
            @click="resetView"
          >
            <RotateCcw :size="14" />
          </button>
        </div>

        <!-- Тултип для узкого экрана: панель разбора там не помещается, а
             название района нужно сразу под пальцем. -->
        <div
          v-if="hover && tip"
          class="pointer-events-none absolute z-10 max-w-[15rem] -translate-x-1/2 -translate-y-full rounded-control border border-prussian-200/25 bg-prussian-900/95 px-3 py-2 lg:hidden"
          :style="{ left: `${tip.x}px`, top: `${Math.max(tip.y - 8, 8)}px` }"
        >
          <p class="text-label text-prussian-200/70">{{ regionOf(hover) }}</p>
          <p class="mt-0.5 text-body font-semibold text-prussian-50">{{ nameOf(hover) }}</p>
          <p v-if="hover.value !== null" class="mt-1 font-mono text-body text-prussian-50">
            {{ boundText(hover.M0) }}
          </p>
          <p v-else class="mt-1 text-note text-prussian-100/70">{{ noValueText(hover) }}</p>
        </div>

        <p
          v-if="state !== 'ready'"
          class="absolute inset-0 flex items-center justify-center px-6 text-center text-body text-prussian-100/60"
        >
          {{ stateText }}
        </p>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex items-center gap-1.5">
          <span v-for="c in legend" :key="c" class="h-2 w-8 rounded-sm" :style="{ background: c }" />
          <span class="ml-2 text-label text-prussian-200/50">0 → 0,5+</span>
        </div>
        <span class="flex items-center gap-1.5 text-label text-prussian-200/50">
          <span class="h-2 w-4 rounded-sm" :style="{ background: SCALE_COLORS.none }" />
          мало объектов для оценки
        </span>
        <span class="flex items-center gap-1.5 text-label text-prussian-200/50">
          <span class="h-2 w-4 rounded-sm" :style="{ background: SCALE_COLORS.absent }" />
          объектов не загружено
        </span>
      </div>

      <!-- Пропуск в слое границ. Район без геометрии не рисуется вообще, и на
           карте на его месте дыра. Молчать о ней нельзя: читатель видит не
           «границы не загружены», а отсутствие территории. -->
      <p v-if="missing.length" class="mt-2 text-label text-prussian-200/45">
        Границ нет у {{ missing.length }} из {{ expected }} районов, на карте они не показаны:
        {{ missingNames }}
      </p>
    </div>

    <!-- The breakdown is the whole point of putting the map here. A composite is
         never shown without the dimensions it was assembled from: a district can
         reach the same M0 from a roof problem or from a shift problem, and those
         are different decisions. На узком экране панель не показывается: там
         вместо неё тултип у точки касания. -->
    <div class="panel-quiet hidden border-prussian-200/20 bg-prussian-900/30 p-4 lg:block">
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
          {{ noValueText(hover) }}
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
 * Deliberately not Leaflet. There are no tiles and no basemap here - the only
 * thing on screen is the district layer itself. Pulling in a mapping engine and a
 * tile provider for that would put a second copy of the map stack on the marketing
 * page, and the hero already has a canvas. This is one canvas, one fetch and a
 * point-in-polygon test.
 *
 * Hit testing walks the features in reverse and stops at the first ring that
 * contains the cursor, with a bounding-box reject in front of the ray cast.
 *
 * ДОБАВЛЕНО. Масштаб и сдвиг внутри контейнера. Часть районов на общем плане
 * занимает пару пикселей: навести на них было нельзя, рассмотреть тем более.
 * Масштаб меняется кнопками, а не колесом, потому что колесо над картой отнимает
 * прокрутку у страницы. Перетаскивание работает и мышью, и пальцем, а
 * вертикальный скролл страницы над картой сохранён через touch-action: pan-y.
 *
 * Преобразование живёт отдельно от проекции: рисование делает translate/scale на
 * контексте, а попадание курсора переводится обратно в базовые координаты. Кольца
 * проецируются одной и той же функцией в обоих случаях, поэтому подсветка не
 * может разойтись с картинкой.
 */
import { Plus, Minus, RotateCcw } from 'lucide-vue-next'

const { $api } = useNuxtApp()
const scale = useScale()
const SCALE_COLORS = scale.SCALE_COLORS
const legend = scale.legend

const TYPES = [
  { value: 'school', label: 'Школы' },
  { value: 'kindergarten', label: 'Детские сады' },
  { value: 'health_post', label: 'ФАП и СВП' },
]

const ZOOM_MAX = 8

const wrap = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const objectType = ref('school')
const hover = ref<any>(null)
const tip = ref<{ x: number; y: number } | null>(null)
const state = ref<'loading' | 'empty' | 'ready'>('loading')

const missing = ref<{ districtCode: string; name: string }[]>([])
const expected = ref(0)

const missingNames = computed(() => {
  const names = missing.value.map((m) => m.name)
  return names.length > 6 ? `${names.slice(0, 6).join(', ')} и ещё ${names.length - 6}` : names.join(', ')
})

const zoom = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)

const stateText = computed(() =>
  state.value === 'loading'
    ? 'Слой загружается…'
    : 'Слой районов пуст. Границы ещё не загружены в базу.',
)

let features: any[] = []
let bbox = { minX: 0, minY: 0, maxX: 0, maxY: 0 }
let ro: ResizeObserver | null = null
let abort: AbortController | null = null
let dragFrom: { x: number; y: number; tx: number; ty: number } | null = null
let moved = false

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
    const [xi, yi] = ring[i] as number[]
    const [xj, yj] = ring[j] as number[]
    if ((yi! > y) !== (yj! > y) && x < ((xj! - xi!) * (y - yi!)) / (yj! - yi!) + xi!) inside = !inside
  }
  return inside
}

// ── view transform ───────────────────────────────────────────────────────────

const clampPan = () => {
  const el = wrap.value
  if (!el) return
  // Сдвиг ограничен так, чтобы слой не улетал за край контейнера.
  const limX = ((zoom.value - 1) * el.clientWidth) / 2
  const limY = ((zoom.value - 1) * el.clientHeight) / 2
  tx.value = Math.max(-limX, Math.min(limX, tx.value))
  ty.value = Math.max(-limY, Math.min(limY, ty.value))
}

const zoomBy = (k: number) => {
  const next = Math.max(1, Math.min(ZOOM_MAX, zoom.value * k))
  if (next === zoom.value) return
  // Увеличение от центра контейнера: сдвиг масштабируется вместе со слоем.
  const ratio = next / zoom.value
  zoom.value = next
  tx.value *= ratio
  ty.value *= ratio
  if (zoom.value === 1) {
    tx.value = 0
    ty.value = 0
  }
  clampPan()
  draw()
}

const resetView = () => {
  zoom.value = 1
  tx.value = 0
  ty.value = 0
  draw()
}

/** Экранная точка -> базовая (та, в которой спроецированы кольца). */
const toBase = (mx: number, my: number) => {
  const el = wrap.value
  if (!el) return { x: mx, y: my }
  const w = el.clientWidth
  const h = el.clientHeight
  return {
    x: (mx - w / 2 - tx.value) / zoom.value + w / 2,
    y: (my - h / 2 - ty.value) / zoom.value + h / 2,
  }
}

// ── draw ─────────────────────────────────────────────────────────────────────

const fillOf = (p: any) => {
  if (p?.status === 'no_objects') return SCALE_COLORS.absent
  if (p?.value === null || p?.value === undefined) return SCALE_COLORS.none
  return scale.deficiency(p.value)
}

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

  ctx.translate(w / 2 + tx.value, h / 2 + ty.value)
  ctx.scale(zoom.value, zoom.value)
  ctx.translate(-w / 2, -h / 2)

  const p = projector(w, h)
  ctx.lineJoin = 'round'

  // Подсвеченный район рисуется последним, иначе соседний контур ложится
  // поверх его обводки и выделение теряется на общем плане.
  const order = [...features].sort((a, b) =>
    (a.properties === hover.value ? 1 : 0) - (b.properties === hover.value ? 1 : 0),
  )

  for (const f of order) {
    const isHover = hover.value === f.properties
    ctx.beginPath()
    for (const poly of ringsOf(f.geometry)) {
      for (const ring of poly) {
        ring.forEach(([lon, lat]: number[], i: number) => {
          const [x, y] = p(lon!, lat!)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.closePath()
      }
    }
    const props = f.properties
    ctx.fillStyle = fillOf(props)
    ctx.globalAlpha = props.value === null || props.value === undefined ? 0.3 : isHover ? 0.95 : 0.7
    ctx.fill('evenodd')
    ctx.globalAlpha = 1
    // Толщина линии делится на масштаб: иначе на увеличении обводка растёт
    // вместе со слоем и съедает мелкие районы.
    ctx.strokeStyle = isHover ? '#EDF3F7' : 'rgba(237,243,247,0.25)'
    ctx.lineWidth = (isHover ? 1.6 : 0.6) / zoom.value
    ctx.stroke()
  }
}

// ── interaction ──────────────────────────────────────────────────────────────

const hitTest = (mx: number, my: number) => {
  const el = wrap.value
  if (!el || !features.length) return null
  const w = el.clientWidth
  const h = el.clientHeight
  const p = projector(w, h)
  const base = toBase(mx, my)

  // The cursor is in screen space and the rings are in degrees, so the test runs
  // in base screen space: every ring is projected once per check. Cheap at this
  // size, and it avoids inverting the projection.
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i]
    for (const poly of ringsOf(f.geometry)) {
      const outer = poly[0]
      if (!outer?.length) continue
      const projectedRing = outer.map(([lon, lat]: number[]) => p(lon!, lat!))
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const [x, y] of projectedRing) {
        if (x! < minX) minX = x!
        if (y! < minY) minY = y!
        if (x! > maxX) maxX = x!
        if (y! > maxY) maxY = y!
      }
      if (base.x < minX || base.x > maxX || base.y < minY || base.y > maxY) continue
      if (pointInRing(base.x, base.y, projectedRing)) return f.properties
    }
  }
  return null
}

const localPoint = (e: PointerEvent) => {
  const c = cv.value
  if (!c) return { x: 0, y: 0 }
  const rect = c.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

const onDown = (e: PointerEvent) => {
  const pt = localPoint(e)
  dragging.value = true
  moved = false
  dragFrom = { x: pt.x, y: pt.y, tx: tx.value, ty: ty.value }
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
}

const onMove = (e: PointerEvent) => {
  const pt = localPoint(e)

  if (dragging.value && dragFrom) {
    const dx = pt.x - dragFrom.x
    const dy = pt.y - dragFrom.y
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    if (zoom.value > 1) {
      tx.value = dragFrom.tx + dx
      ty.value = dragFrom.ty + dy
      clampPan()
      draw()
    }
    return
  }

  // Касание не даёт наведения: на узком экране район выбирается тапом, иначе
  // тултип появлялся бы под пальцем при каждом скролле.
  if (e.pointerType !== 'mouse') return

  const hit = hitTest(pt.x, pt.y)
  tip.value = hit ? pt : null
  if (hover.value !== hit) {
    hover.value = hit
    draw()
  }
}

const onUp = (e: PointerEvent) => {
  const wasDragging = dragging.value
  dragging.value = false
  dragFrom = null
  if (!wasDragging || moved) return
  // Тап без перетаскивания = выбор района.
  if (e.pointerType === 'mouse') return
  const pt = localPoint(e)
  const hit = hitTest(pt.x, pt.y)
  tip.value = hit ? pt : null
  if (hover.value !== hit) {
    hover.value = hit
    draw()
  }
}

const onLeave = (e: PointerEvent) => {
  if (e.pointerType !== 'mouse') return
  dragging.value = false
  dragFrom = null
  tip.value = null
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

// Два разных утверждения об одном сером районе. Первое про порог публикации,
// второе про покрытие загрузки.
const noValueText = (p: any) =>
  p?.status === 'no_objects'
    ? 'Объектов этого типа в районе не загружено. Пустое покрытие, а не нулевая оценка.'
    : `Объектов в районе меньше порога (${p?.assessed ?? 0}). Доля по такой выборке не публикуется.`

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
  tip.value = null
  try {
    const res = await $api<any>('/analytics/deprivation/choropleth', {
      query: { objectType: objectType.value, bound: 'lower' },
      signal: controller.signal,
    })
    if (controller.signal.aborted) return
    const gj = res?.type === 'FeatureCollection' ? res : res?.data
    features = (gj?.features ?? []).filter((f: any) => f.geometry)
    missing.value = gj?.meta?.boundariesMissing ?? []
    expected.value = gj?.meta?.districtsExpected ?? 0
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
    missing.value = []
    expected.value = 0
    state.value = 'empty'
  } finally {
    if (abort === controller) abort = null
  }
}

watch(objectType, load)

onMounted(() => {
  load()
  ro = new ResizeObserver(() => {
    clampPan()
    draw()
  })
  if (wrap.value) ro.observe(wrap.value)
})

onBeforeUnmount(() => {
  abort?.abort()
  ro?.disconnect()
})
</script>

<style scoped>
.zoom-btn {
  @apply inline-flex h-8 w-8 items-center justify-center rounded-control border border-prussian-200/25 bg-prussian-900/70 text-prussian-100 transition-colors hover:bg-prussian-800 disabled:cursor-not-allowed disabled:opacity-40;
}
</style>
