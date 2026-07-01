<template>
  <div class="flex flex-col md:flex-row items-center gap-8">
    <div class="relative shrink-0" style="width: 200px; height: 200px;">
      <svg viewBox="0 0 200 200" class="w-full h-full -rotate-90">
        <circle cx="100" cy="100" :r="radius" fill="none" :stroke="colorB" stroke-width="20" />
        <circle
          cx="100" cy="100" :r="radius" fill="none" :stroke="colorA" stroke-width="20"
          stroke-linecap="round" :stroke-dasharray="`${dash} ${circumference - dash}`"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-4xl font-black text-slate-800 dark:text-white">{{ percent }}%</span>
        <span class="text-[11px] text-slate-400">{{ centerLabel }}</span>
      </div>
    </div>

    <div class="flex-1 w-full max-w-md space-y-3">
      <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
        <span class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: colorA }" />
          {{ labelA }}
        </span>
        <span class="text-sm font-black text-slate-700 dark:text-slate-200">{{ percent }}%</span>
      </div>
      <div class="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3">
        <span class="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: colorB }" />
          {{ labelB }}
        </span>
        <span class="text-sm font-black text-slate-700 dark:text-slate-200">{{ 100 - percent }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    percent: number
    labelA?: string
    labelB?: string
    centerLabel?: string
    colorA?: string
    colorB?: string
  }>(),
  {
    labelA: 'Удовлетворены',
    labelB: 'Не удовлетворены',
    centerLabel: 'Удовлетворенность',
    colorA: '#3b82f6',
    colorB: '#ef4444',
  },
)

const radius = 80
const circumference = 2 * Math.PI * radius
const dash = computed(() => (circumference * props.percent) / 100)
</script>
