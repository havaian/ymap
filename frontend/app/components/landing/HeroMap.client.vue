<template>
  <div ref="wrap" class="relative h-full w-full">
    <canvas ref="cv" class="block h-full w-full" />

    <!-- УДАЛЕНО: слой якорей - точки городов с названиями и числами объектов.
         Подписи спорили с самим облаком: они лежали на его самом плотном месте,
         а без них светлые точки городов ничего не сообщали.

         Данные никуда не делись: anchors по-прежнему считаются в
         backend/src/scripts/build-landing-data.js и лежат в
         public/data/facility-points.json, так что вернуть слой - это разметка
         и чтение data.anchors, без пересчёта. -->

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
 * Drawn on canvas rather than as six thousand SVG nodes.
 *
 * ПЕРЕДЕЛАНО. Убран проход развёртки с запада на восток. Он рисовал точки двумя
 * вёдрами - тусклым и ярким - и яркое ведро было полосой шириной 1,6 градуса
 * перед границей прохода. На последнем кадре полоса застывала над востоком
 * страны: Наманган светился, остальное оставалось тусклым. Цикличность убрана
 * вместе с ней, плита рисуется один раз.
 *
 * Осталось одно появление: прозрачность всего облака поднимается до рабочей за
 * 700 мс, все точки одного цвета. Ни ведра тусклых точек, ни полосы, ни повтора.
 *
 * Слой городов снят: подписи с числами закрывали самое плотное место облака, а
 * точки без подписей ничего не говорили. На плите остались только объекты.
 *
 * Проекция считается один раз на изменение размера, а не на каждую точку каждого
 * кадра.
 */
const props = withDefaults(
  defineProps<{
    accent?: string
    /** Сдвиг плиты вправо, долей ширины коробки. Отрицательное значение - влево. */
    shiftX?: number
    /** Сдвиг плиты вверх, долей высоты коробки. Отрицательное - вниз. */
    shiftY?: number
  }>(),
  {
    accent: '#8FC5E8',
    shiftX: 0,
    shiftY: 0,
  },
)

const wrap = ref<HTMLElement | null>(null)
const cv = ref<HTMLCanvasElement | null>(null)

const meta = ref<{ sampled?: number; totalWithCoords?: number }>({})

let pts: number[] = []
// Screen-space copy of the cloud, rebuilt only when the box changes size. Two
// numbers per point.
let projected: Float32Array = new Float32Array(0)
let bounds = { latMin: 37.1, latMax: 45.7, lonMin: 55.9, lonMax: 73.4 }
let raf = 0
let fadeStart = 0
let alpha = 0
let ro: ResizeObserver | null = null
let io: IntersectionObserver | null = null
let done = false
let reduced = false

// Рабочая прозрачность плиты и длительность единственного появления.
const FINAL_ALPHA = 0.9
const FADE_MS = 700

// Доля коробки, которую плита занимает по стеснённой стороне. Меньше единицы,
// потому что сдвиг вверх без запаса срезал бы верх облака: по высоте страна
// вписана впритык, слабина есть только по ширине.
const FIT = 0.9

// Equirectangular with a cos(lat) correction: at 41 degrees N an unadjusted plot
// stretches the country sideways by a third and the shape stops being
// recognisable.
const project = (lat: number, lon: number, w: number, h: number) => {
  const midLat = ((bounds.latMin + bounds.latMax) / 2) * (Math.PI / 180)
  const spanX = (bounds.lonMax - bounds.lonMin) * Math.cos(midLat)
  const spanY = bounds.latMax - bounds.latMin
  const scale = Math.min(w / spanX, h / spanY) * FIT
  // Центр плиты смещается вместе с подписями: они проецируются этой же
  // функцией, поэтому точка и её метка не могут разъехаться.
  const cx = w / 2 + props.shiftX * w
  const cy = h / 2 - props.shiftY * h
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
  if (projected.length !== n * 2) projected = new Float32Array(n * 2)
  for (let i = 0, j = 0; i < pts.length; i += 2, j += 2) {
    const p = project(pts[i]!, pts[i + 1]!, w, h)
    projected[j] = p.x
    projected[j + 1] = p.y
  }
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

  // Одно ведро, одно присвоение fillStyle на кадр. Все точки одного цвета: карта
  // показывает покрытие, а не порядок обхода.
  ctx.globalAlpha = alpha
  ctx.fillStyle = props.accent
  for (let j = 0; j < projected.length; j += 2) {
    ctx.fillRect(projected[j]!, projected[j + 1]!, 1.6, 1.6)
  }
  ctx.globalAlpha = 1
}

const animate = (now: number) => {
  if (!fadeStart) fadeStart = now
  alpha = Math.min(FINAL_ALPHA, (FINAL_ALPHA * (now - fadeStart)) / FADE_MS)
  draw()
  if (alpha >= FINAL_ALPHA) {
    // Появление одно и без повтора: дальше кадры не нужны вообще.
    done = true
    raf = 0
    return
  }
  raf = requestAnimationFrame(animate)
}

const start = () => {
  if (raf || done || reduced) return
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
    meta.value = { sampled: data.sampled, totalWithCoords: data.totalWithCoords }
  } catch {
    // No cloud is better than a fake one: the section keeps its copy and loses
    // only the plate.
    pts = []
  }

  reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  reproject()
  if (reduced) {
    alpha = FINAL_ALPHA
    done = true
  }
  draw()

  ro = new ResizeObserver(() => {
    reproject()
    draw()
  })
  if (wrap.value) ro.observe(wrap.value)

  // Появление начинается, когда плиту видно, и больше не запускается.
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        start()
        if (done) io?.disconnect()
      }
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
