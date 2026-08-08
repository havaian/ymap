<template>
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <div class="min-w-0">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h2 class="text-h3 font-semibold text-ink dark:text-paper">{{ title }}</h2>
      <!-- One line saying what the section measures. Not a tagline: if it cannot
           say something true about the method or the denominator, it is left off. -->
      <p v-if="note" class="mt-1 text-note text-ink-muted dark:text-ink-faint">{{ note }}</p>
    </div>
    <div v-if="$slots.actions" class="shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ title: string; eyebrow?: string; note?: string }>(), {
  eyebrow: '',
  note: '',
})
</script>
