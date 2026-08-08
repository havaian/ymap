<template>
  <div class="panel p-5">
    <p class="eyebrow">{{ label }}</p>
    <div class="mt-3">
      <MeasuredValue
        :value="value"
        :bound="bound"
        :format="format"
        :digits="digits"
        :unit="unit"
        :color="color"
        size="lg"
      />
    </div>
    <!-- The denominator is part of the figure, not a caption under it. A rate
         without the count behind it is the main way a small sample gets quoted as
         if it were a national number. -->
    <p v-if="denominator" class="mt-2 text-note text-ink-muted dark:text-ink-faint">{{ denominator }}</p>
    <p v-if="hint" class="mt-1 text-note text-ink-faint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value?: number | string | null
    bound?: { lower: number | null; upper: number | null } | null
    format?: 'raw' | 'percent'
    digits?: number
    unit?: string
    denominator?: string
    hint?: string
    color?: string
  }>(),
  {
    value: null,
    bound: null,
    format: 'raw',
    digits: 1,
    unit: '',
    denominator: '',
    hint: '',
    color: '',
  },
)
</script>
