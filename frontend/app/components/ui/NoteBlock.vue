<template>
  <div class="rounded-panel border p-4" :class="tone === 'caution' ? cautionClass : quietClass">
    <p v-if="title" class="text-body font-semibold" :class="tone === 'caution' ? 'text-scale-poor' : 'text-ink dark:text-paper'">
      {{ title }}
    </p>
    <div class="text-note" :class="[title ? 'mt-1' : '', tone === 'caution' ? 'text-scale-poor' : 'text-ink-muted dark:text-ink-faint']">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Method, denominators and assumptions. They belong next to the figure rather than
 * in a footnote, and they are not a warning: a stated limit is what makes a number
 * usable. 'caution' is reserved for the case where a figure is being withheld or a
 * factor is not applied, which is a different thing from a caveat.
 */
withDefaults(defineProps<{ title?: string; tone?: 'quiet' | 'caution' }>(), {
  title: '',
  tone: 'quiet',
})

const quietClass = 'border-rule bg-paper-sunk dark:border-night-rule dark:bg-night-sunk'
const cautionClass = 'border-scale-poor/30 bg-scale-poor/5'
</script>
