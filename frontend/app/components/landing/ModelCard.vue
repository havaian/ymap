<template>
  <div class="panel p-5 sm:p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h3 class="mt-2 font-display text-h3 font-semibold text-ink dark:text-paper">{{ title }}</h3>
      </div>
      <NuxtLink
        :to="to"
        class="shrink-0 rounded-control p-1 text-ink-faint transition-colors hover:text-prussian-600 dark:hover:text-prussian-200"
        :aria-label="`Открыть раздел «${title}»`"
      >
        <ArrowUpRight :size="18" />
      </NuxtLink>
    </div>

    <p class="mt-3 text-body text-ink-muted dark:text-ink-faint">{{ body }}</p>

    <div class="mt-5 flex items-baseline gap-2 border-t border-rule pt-4 dark:border-night-rule">
      <span class="font-display text-h2 font-semibold text-ink dark:text-paper">
        <CountUp :raw="figureRaw" :value="figureValue" :decimals="figureDecimals" :suffix="figureSuffix" />
      </span>
      <span class="text-note text-ink-faint">{{ figureLabel }}</span>
    </div>

    <!-- Expandable rather than a second page. Anyone who wants the figure has it
         above; anyone who wants to know whether to trust it needs the denominator
         and the assumption, and those two belong next to each other.

         Height animates through grid-template-rows, not transform: scale - the
         card must not blur or resize its own type while it opens. -->
    <button
      type="button"
      class="mt-4 flex w-full items-center gap-1.5 text-label font-medium text-prussian-600 transition-colors hover:text-prussian-700 dark:text-prussian-200 dark:hover:text-prussian-100"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronDown :size="14" :class="['transition-transform duration-instant', open ? 'rotate-180' : '']" />
      {{ open ? 'Свернуть методику' : 'Как это считается' }}
    </button>

    <div
      class="grid transition-[grid-template-rows] duration-200 ease-out"
      :style="{ gridTemplateRows: open ? '1fr' : '0fr' }"
    >
      <div class="overflow-hidden">
        <dl class="mt-3 space-y-3 border-t border-rule pt-3 dark:border-night-rule">
          <div v-for="row in method" :key="row.term">
            <dt class="text-label font-medium text-ink dark:text-paper">{{ row.term }}</dt>
            <dd class="mt-0.5 text-note text-ink-muted dark:text-ink-faint">{{ row.def }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowUpRight, ChevronDown } from 'lucide-vue-next'

defineProps<{
  eyebrow: string
  title: string
  body: string
  to: string
  /** Printed verbatim when the figure is an interval or carries a unit. */
  figureRaw?: string
  figureValue?: number
  figureDecimals?: number
  figureSuffix?: string
  figureLabel: string
  method: { term: string; def: string }[]
}>()

const open = ref(false)
</script>
