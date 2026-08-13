<template>
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <div class="min-w-0">
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h2 class="text-h3 font-semibold text-ink dark:text-paper">{{ title }}</h2>
      <!-- One line saying what the section measures. Not a tagline: if it cannot
           say something true about the method or the denominator, it is left off. -->
      <p v-if="note" class="mt-1 text-note text-ink-muted dark:text-ink-faint">{{ note }}</p>
    </div>
    <!-- Действия раздела уходят под заголовок на телефоне и не сжимаются: при
         shrink-0 в одной строке с заголовком поле «минимум оценённых» и селект
         сортировки выдавливали заголовок в узкую колонку. -->
    <div v-if="$slots.actions" class="w-full sm:w-auto sm:shrink-0">
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
