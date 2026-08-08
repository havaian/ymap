<template>
  <span class="inline-flex items-baseline gap-1.5 tabular">
    <span :class="valueClass" :style="color ? { color } : undefined">{{ text }}</span>
    <span v-if="unit" class="text-note text-ink-faint dark:text-ink-faint">{{ unit }}</span>
    <!-- The bracket is drawn, not described. A reader should be able to tell at a
         glance whether a figure is known or bounded without reading a footnote. -->
    <span
      v-if="bounded"
      class="text-label text-ink-faint dark:text-ink-faint"
      :title="boundHint"
      aria-hidden="true"
    >⟨⟩</span>
    <span v-if="bounded" class="sr-only">{{ boundHint }}</span>
  </span>
</template>

<script setup lang="ts">
/**
 * A measured value.
 *
 * Every figure in the observatory carries a denominator, a date and sometimes an
 * interval, and the interval is the part that usually gets lost. Written as
 * "0.18 – 0.20" in body text it reads as a typo; averaged into a midpoint it stops
 * being an interval at all. So it gets its own primitive: one number when the
 * number is known, a span when it is not, and a mark that says which.
 *
 * A bound that collapsed to a point is rendered as a point. Printing "18 – 18"
 * would claim an uncertainty that is not there.
 */
const props = withDefaults(
  defineProps<{
    /** A plain value, or a bound. When bound is given, value is ignored. */
    value?: number | string | null
    bound?: { lower: number | null; upper: number | null } | null
    /** 'raw' prints as given, 'percent' multiplies by 100 and appends the sign. */
    format?: 'raw' | 'percent'
    digits?: number
    unit?: string
    size?: 'sm' | 'md' | 'lg'
    color?: string
    boundHint?: string
  }>(),
  {
    value: null,
    bound: null,
    format: 'raw',
    digits: 1,
    unit: '',
    size: 'md',
    color: '',
    boundHint: 'Значение известно с точностью до интервала',
  },
)

const one = (n: number | string | null): string => {
  if (n === null || n === undefined || n === '') return '-'
  const x = typeof n === 'string' ? Number(n) : n
  if (typeof x !== 'number' || Number.isNaN(x)) return String(n)
  return props.format === 'percent' ? (x * 100).toFixed(props.digits) : String(x)
}

const bounded = computed(() => {
  const b = props.bound
  return !!b && b.lower !== null && b.upper !== null && b.lower !== b.upper
})

const text = computed(() => {
  const b = props.bound
  if (b) {
    if (b.lower === null && b.upper === null) return '-'
    if (b.lower === b.upper) return one(b.lower)
    return `${one(b.lower)} – ${one(b.upper)}`
  }
  return one(props.value)
})

// The display face is kept for the one big reading per panel. At inline sizes a
// geometric face fights the text around it and the figure stops standing out by
// being a figure.
const valueClass = computed(() => {
  const base = 'font-semibold text-ink dark:text-paper'
  if (props.size === 'lg') return `font-display ${base} text-figure`
  if (props.size === 'sm') return `${base} text-lead`
  return `${base} text-h2`
})
</script>
