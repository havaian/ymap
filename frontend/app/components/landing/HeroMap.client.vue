<template>
  <div ref="wrap" class="relative h-full w-full">
    <canvas ref="cv" class="block h-full w-full" />

    <!-- Anchors sit at real coordinates and carry counts computed from the same
         cloud, so a figure on the hero cannot drift away from the data under it. -->
    <button
      v-for="(a, i) in anchors"
      :key="a.name"
      type="button"
      class="absolute -translate-x-1/2 -translate-y-1/2 rounded-control px-2 py-1 text-left transition-colors"
      :class="active === i ? 'bg-prussian-200/20' : 'hover:bg-prussian-200/10'"
      :style="anchorStyle(a)"
      @mouseenter="active = i"
      @mouseleave="active = null"
      @focus="active = i"
      @blur="active = null"
    >
      <span class="block h-1.5 w-1.5 rounded-full bg-prussian-100 ring-4 ring-prussian-100/20" />
      <span class="mt-1.5 block whitespace-nowrap text-label text-prussian-100/70">{{ a.name }}</span>
      <span class="block whitespace-nowrap font-mono text-body text-prussian-50">{{ a.count.toLocaleString('ru-RU') }}</span>
    </button>

    <p class="absolute bottom-2 right-3 text-label text-prussian-200/40">
      {{ meta.sampled?.toLocaleString('ru-RU') }} из {{ meta.totalWithCoords?.toLocaleString('ru-RU') }} точек · data.egov.uz
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The hero map.
 *
 * Not a rendering of a map: every dot is one preschool whose coordinate came out
 * of the state registries after the orientation repair. The outline of the country
 * appears on its own because facilities follow settlement, which says the thing the
 * page is about before any copy does.
 *
 * Drawn on canvas rather than as six thousand SVG nodes, and the reveal is a sweep
 * from west to east because that is how the country is surveyed on paper, left to
 * right. Reduced motion skips straight to the finished plate.
 */
const props = withDefaults(defineProps<{ accent?: string; dim?: string }>(), {
  accent: '#8FC5E8',
  dim: '#2A6082',
})

const wrap = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)
const active = ref<number | null>(null)

const meta = ref<{ sampled?: number; totalWithCoords?: number }>({})
const anchors = ref<{ name: string; lat: number; lon: number; count: number }[]>([])

let pts: number[] = []
let bounds = { latMin: 37.1, latMax: 45.7, lonMin: 55.9, lonMax: 73.4 }
let raf = 0
let progress = 0
let ro: ResizeObserver | null = null

// Equirectangular with a cos(lat) correction: at 41°N an unadjusted plot stretches
// the country sideways by a third and the shape stops being recognisable.
const project = (lat: number, lon: number, w: number, h: number) => {
  const midLat = ((bounds.latMin + bounds.latMax) / 2) * (Math.PI / 180)
  const spanX = (bounds.lonMax - bounds.lonMin) * Math.cos(midLat)
  const spanY = bounds.latMax - bounds.latMin
  const scale = Math.min(w / spanX, h / spanY)
  const cx = w / 2
  const cy = h / 2
  const x = cx + ((lon - (bounds.lonMin + bounds.lonMax) / 2) * Math.cos(midLat)) * scale
  const y = cy - (lat - (bounds.latMin + bounds.latMax) / 2) * scale
  return { x, y, scale }
}

const size = () => {
  const el = wrap.value
  return { w: el?.clientWidth ?? 0, h: el?.clientHeight ?? 0 }
}

const anchorStyle = (a: { lat: number; lon: number }) => {
  const { w, h } = size()
  if (!w || !h) return { left: '-999px', top: '-999px' }
  const p = project(a.lat, a.lon, w, h)
  return { left: `${p.x}px`, top: `${p.y}px` }
}

const draw = () => {
  const c = cv.value
  const el = wrap.value
  if (!c || !el) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = el.clientWidth
  const h = el.clientHeight
  if (c.width !== w * dpr || c.height !== h * dpr) {
    c.width = w * dpr
    c.height = h * dpr
  }
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  // The sweep runs on longitude, so points appear in the order a survey would
  // cover them rather than in the order they happen to sit in the file.
  const cutoff = bounds.lonMin + (bounds.lonMax - bounds.lonMin) * progress

  for (let i = 0; i < pts.length; i += 2) {
    const lat = pts[i]
    const lon = pts[i + 1]
    if (lon > cutoff) continue
    const p = project(lat, lon, w, h)
    // Points just behind the sweep line stay bright for a moment, so the edge of
    // the pass is visible without drawing a literal scanning beam.
    const edge = Math.max(0, 1 - (cutoff - lon) / 1.6)
    ctx.fillStyle = edge > 0.05 ? props.accent : props.dim
    ctx.globalAlpha = 0.35 + edge * 0.55
    ctx.fillRect(p.x, p.y, 1.6, 1.6)
  }
  ctx.globalAlpha = 1
}

const animate = () => {
  progress = Math.min(1, progress + 0.008)
  draw()
  if (progress < 1) raf = requestAnimationFrame(animate)
}

onMounted(async () => {
  try {
    const data = await $fetch<any>('/data/facility-points.json')
    pts = data.points ?? []
    bounds = data.bounds ?? bounds
    anchors.value = data.anchors ?? []
    meta.value = { sampled: data.sampled, totalWithCoords: data.totalWithCoords }
  } catch {
    // No cloud is better than a fake one: the section keeps its copy and loses
    // only the plate.
    pts = []
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  progress = reduced ? 1 : 0
  draw()
  if (!reduced) raf = requestAnimationFrame(animate)

  ro = new ResizeObserver(() => draw())
  if (wrap.value) ro.observe(wrap.value)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})
</script>
