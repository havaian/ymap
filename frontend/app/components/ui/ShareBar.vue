<template>
  <div class="flex items-center gap-3">
    <span v-if="label" class="shrink-0 truncate text-body text-ink-muted dark:text-ink-faint" :style="{ width: labelWidth }">
      {{ label }}
    </span>

    <span class="span-track flex-1">
      <!-- Upper bound first and faded: what the value could be if the missing field
           went the other way. The solid bar is what the data actually supports. -->
      <span v-if="hasBand" class="span-upper" :style="{ width: pct(upper), background: color }" />
      <span class="span-lower" :style="{ width: pct(lower), background: color }" />
    </span>

    <span class="shrink-0 text-right text-body tabular text-ink dark:text-paper" :style="{ width: valueWidth }">
      {{ text }}
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * A share, drawn. Takes 0..1, not 0..100, because every share in the API arrives
 * that way and converting at the call site is where sign errors come from.
 *
 * When an upper bound is supplied and differs from the lower one, the band is
 * drawn rather than described. This is the same device as MeasuredValue and is
 * meant to be recognised as the same thing.
 */
const props = withDefaults(
  defineProps<{
    lower: number | null
    upper?: number | null
    label?: string
    color?: string
    digits?: number
    labelWidth?: string
    valueWidth?: string
  }>(),
  {
    upper: null,
    label: '',
    color: '#14415C',
    digits: 1,
    labelWidth: '11rem',
    valueWidth: '7rem',
  },
)

const hasBand = computed(
  () => props.upper !== null && props.upper !== undefined && props.upper !== props.lower,
)

const clamp = (v: number | null) => (v === null || v === undefined ? 0 : Math.max(0, Math.min(1, v)))
const pct = (v: number | null) => `${(clamp(v) * 100).toFixed(2)}%`

const fmt = (v: number | null) => (v === null || v === undefined ? '-' : `${(v * 100).toFixed(props.digits)}`)

const text = computed(() =>
  hasBand.value ? `${fmt(props.lower)} – ${fmt(props.upper)} %` : `${fmt(props.lower)} %`,
)
</script>
