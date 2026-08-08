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
      :style="anchorPositions[i]"
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
 *
 * REWORKED on three counts.
 *
 * The sweep now loops. It reached the eastern edge, stopped, and anyone arriving a
 * few seconds late never saw the thing the section is built around. After the plate
 * completes it holds, then the pass runs again.
 *
 * The draw loop was setting ctx.fillStyle once per point: six thousand context
 * state changes per frame, and a context state change is not free. Points are
 * bucketed into the two colours the plate uses and each bucket is filled in one
 * pass, which is two state changes per frame instead of six thousand. Projection
 * is precomputed on resize rather than recomputed per point per frame.
 *
 * Anchor positions were read out of the template through clientWidth. Every render
 * forced a synchronous layout, and hovering one anchor re-rendered all five. They
 * are computed on resize into a plain array now.
 *
 * The loop also stops when the hero is off screen. A canvas animating behind three
 * screens of scrolled content is pure cost.
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
const anchorPositions = ref<{ left: string; top: string }[]>([])

let pts: number[] = []
// Screen-space copy of the cloud, rebuilt only when the box changes size. x, y and
// the longitude the sweep tests against, flat, three numbers per point.
let projected: Float32Array = new Float32Array(0)
let bounds = { latMin: 37.1, latMax: 45.7, lonMin: 55.9, lonMax: 73.4 }
let raf = 0
let progress = 0
let holdUntil = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let visible = true
let reduced = false

// How long the finished plate is held before the pass runs again, and how fast the
// pass moves. A pass of about six seconds and a hold of four reads as a survey
// repeating, not as a loading bar stuck in a loop.
const SWEEP_PER_FRAME = 0.0055
const HOLD_MS = 4000

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

/**
 * Projection is a function of the box size and nothing else, so it is done once
 * per resize and read straight out of a typed array while drawing.
 */
const reproject = () => {
  const { w, h } = size()
  if (!w || !h) return
  const n = pts.length / 2
  if (projected.length !== n * 3) projected = new Float32Array(n * 3)
  for (let i = 0, j = 0; i < pts.length; i += 2, j += 3) {
    const lat = pts[i]
    const lon = pts[i + 1]
    const p = project(lat, lon, w, h)
    projected[j] = p.x
    projected[j + 1] = p.y
    projected[j + 2] = lon
  }
  anchorPositions.value = anchors.value.map((a) => {
    const p = project(a.lat, a.lon, w, h)
    return { left: `${p.x}px`, top: `${p.y}px` }
  })
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

  // Two passes, two fillStyle assignments. Points just behind the sweep line stay
  // bright for a moment, so the edge of the pass is visible without drawing a
  // literal scanning beam; that band is the second bucket.
  ctx.globalAlpha = 0.55
  ctx.fillStyle = props.dim
  for (let j = 0; j < projected.length; j += 3) {
    const lon = projected[j + 2]
    if (lon > cutoff) continue
    if (cutoff - lon < 1.6) continue
    ctx.fillRect(projected[j], projected[j + 1], 1.6, 1.6)
  }

  ctx.globalAlpha = 0.9
  ctx.fillStyle = props.accent
  for (let j = 0; j < projected.length; j += 3) {
    const lon = projected[j + 2]
    if (lon > cutoff) continue
    if (cutoff - lon >= 1.6) continue
    ctx.fillRect(projected[j], projected[j + 1], 1.6, 1.6)
  }

  ctx.globalAlpha = 1
}

const animate = (now: number) => {
  if (!visible || reduced) {
    raf = 0
    return
  }
  if (holdUntil) {
    // Plate is complete and holding. Nothing is redrawn during the hold; the
    // canvas already carries the finished image.
    if (now >= holdUntil) {
      holdUntil = 0
      progress = 0
    }
    raf = requestAnimationFrame(animate)
    return
  }
  progress = Math.min(1, progress + SWEEP_PER_FRAME)
  draw()
  if (progress >= 1) holdUntil = now + HOLD_MS
  raf = requestAnimationFrame(animate)
}

const start = () => {
  if (raf || reduced || !visible) return
  raf = requestAnimationFrame(animate)
}

const stop = () => {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
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

  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  reproject()
  progress = reduced ? 1 : 0
  draw()
  if (!reduced) start()

  ro = new ResizeObserver(() => {
    reproject()
    draw()
  })
  if (wrap.value) ro.observe(wrap.value)

  // A canvas looping behind three screens of scrolled content is pure cost.
  io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting)
      if (visible) start()
      else stop()
    },
    { threshold: 0 },
  )
  if (wrap.value) io.observe(wrap.value)
})

onBeforeUnmount(() => {
  stop()
  ro?.disconnect()
  io?.disconnect()
})
</script>
