<template>
  <div class="flex flex-col items-center gap-8 md:flex-row">
    <div class="relative shrink-0" style="width: 180px; height: 180px;">
      <svg viewBox="0 0 200 200" class="h-full w-full -rotate-90">
        <circle cx="100" cy="100" :r="radius" fill="none" :stroke="restColor" stroke-width="18" />
        <circle
          cx="100" cy="100" :r="radius" fill="none" :stroke="mainColor" stroke-width="18"
          :stroke-dasharray="`${dash} ${circumference - dash}`"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="font-display text-figure font-semibold tabular text-ink dark:text-paper">{{ percent }}%</span>
        <span class="text-label text-ink-faint">{{ centerLabel }}</span>
      </div>
    </div>

    <div class="w-full max-w-md flex-1 space-y-2">
      <div class="flex items-center justify-between rounded-control bg-paper-sunk px-4 py-3 dark:bg-night-sunk">
        <span class="flex items-center gap-2 text-body font-medium text-ink dark:text-paper">
          <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: mainColor }" />
          {{ labelA }}
        </span>
        <span class="font-mono text-body font-semibold text-ink dark:text-paper">{{ percent }}%</span>
      </div>
      <div class="flex items-center justify-between rounded-control bg-paper-sunk px-4 py-3 dark:bg-night-sunk">
        <span class="flex items-center gap-2 text-body font-medium text-ink dark:text-paper">
          <span class="h-2.5 w-2.5 rounded-sm" :style="{ backgroundColor: restColor }" />
          {{ labelB }}
        </span>
        <span class="font-mono text-body font-semibold text-ink dark:text-paper">{{ 100 - percent }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// REWORKED. The two colours were literals - #3b82f6 against #ef4444 - and a share
// this high in saturated red asserted more than the figure supports. Both now come
// off useScale, so the same completeness reads as the same colour here, in a table
// and on the choropleth. stroke-linecap="round" is dropped: a rounded cap overhangs
// the arc and makes a small share look larger than it is.
const props = withDefaults(
  defineProps<{
    percent: number
    labelA?: string
    labelB?: string
    centerLabel?: string
  }>(),
  {
    labelA: 'Удовлетворены',
    labelB: 'Не удовлетворены',
    centerLabel: 'Удовлетворенность',
  },
)

const scale = useScale()

const mainColor = computed(() => scale.completeness(props.percent / 100))
const restColor = scale.SCALE_COLORS.none

const radius = 80
const circumference = 2 * Math.PI * radius
const dash = computed(() => (circumference * props.percent) / 100)
</script>
