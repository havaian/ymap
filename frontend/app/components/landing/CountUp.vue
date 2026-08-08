<template>
  <span ref="el" class="tabular">{{ display }}</span>
</template>

<script setup lang="ts">
/**
 * A figure that counts up once, when it first comes into view.
 *
 * Two rules it follows that the usual version of this does not.
 *
 * It never invents a value. The count runs from zero to the number it was given
 * and lands exactly on it; the intermediate frames are rounded from the same
 * figure, so a screenshot taken mid-animation is still a fraction of the real
 * number rather than a different number.
 *
 * It runs once. A counter that replays every time it scrolls past reads as
 * decoration. This one settles and stays settled, and reduced motion gets the
 * final value with no animation at all.
 *
 * Formatting stays here rather than at the call site so the interval and unit
 * cases (`8,2 - 61,1 %`) can opt out by passing `raw`, which is printed as given.
 */
const props = withDefaults(
  defineProps<{
    value?: number
    /** Printed verbatim, no animation. For intervals and anything non-numeric. */
    raw?: string
    /** Digits after the decimal separator. Russian locale, so a comma. */
    decimals?: number
    suffix?: string
    durationMs?: number
  }>(),
  { value: 0, raw: '', decimals: 0, suffix: '', durationMs: 1100 },
)

const el = ref<HTMLElement | null>(null)
const current = ref(0)
let raf = 0
let io: IntersectionObserver | null = null
let done = false

const format = (n: number) =>
  n.toLocaleString('ru-RU', {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  })

const display = computed(() => (props.raw ? props.raw : format(current.value) + props.suffix))

// Ease-out: the figure decelerates into its final value instead of stopping dead,
// which is what makes it read as settling rather than as a spinner halting.
const ease = (t: number) => 1 - Math.pow(1 - t, 3)

const run = () => {
  if (done) return
  done = true
  const target = props.value
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / props.durationMs)
    current.value = target * ease(t)
    if (t < 1) raf = requestAnimationFrame(step)
    else current.value = target
  }
  raf = requestAnimationFrame(step)
}

onMounted(() => {
  if (props.raw) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) {
    current.value = props.value
    done = true
    return
  }
  io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        run()
        io?.disconnect()
        io = null
      }
    },
    { threshold: 0.4 },
  )
  if (el.value) io.observe(el.value)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  io?.disconnect()
})
</script>
