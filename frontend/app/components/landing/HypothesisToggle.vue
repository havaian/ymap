<template>
  <div>
    <div class="flex flex-wrap items-center gap-2">
      <button
        v-for="h in HYPOTHESES"
        :key="h.key"
        type="button"
        class="rounded-control border px-3 py-2 text-body font-medium transition-colors"
        :class="pick === h.key
          ? 'border-prussian-300 bg-prussian-300/15 text-prussian-50'
          : 'border-prussian-300/25 text-prussian-100/60 hover:text-prussian-50'"
        @click="pick = h.key"
      >
        {{ h.button }}
      </button>
    </div>

    <!-- Твёрдая минимальная высота держит место под самую длинную из двух
         формулировок, чтобы полоса под ней не прыгала при переключении. На
         телефоне строка переносится чаще, поэтому запас там больше. -->
    <p class="mt-3 min-h-[5.2rem] text-body text-prussian-100/70 xs:min-h-[3.9rem] sm:min-h-[2.6rem]">{{ current.reading }}</p>

    <!-- One field, two readings, and the bar moves when the reading changes. The
         gap is the point: it does not close with more data or a better model, only
         by separating the kind of repair in the form. -->
    <div class="mt-4">
      <div class="relative h-3 w-full overflow-hidden rounded-full bg-prussian-300/15">
        <div
          class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
          :style="{ width: `${current.pct}%`, background: current.color }"
        />
        <!-- The other reading stays on screen as a hairline, so switching never
             hides where the alternative sat. -->
        <div
          class="absolute inset-y-0 w-px bg-prussian-50/70 transition-[left] duration-500 ease-out"
          :style="{ left: `${other.pct}%` }"
        />
      </div>

      <!-- Цифра и подпись переносятся на телефоне: 2,5 rem плюс строка в 1 rem
           не помещались в 328 px и рвали подпись посреди слова. -->
      <div class="mt-3 flex flex-wrap items-baseline gap-x-2">
        <span class="font-display text-h1 font-semibold tabular text-prussian-50 xs:text-figure">{{ current.pct }}</span>
        <span class="text-lead text-prussian-100/60">% зданий за пределом нормативного цикла</span>
      </div>
      <p class="mt-1 text-note text-prussian-100/50">
        Другая гипотеза даёт {{ other.pct }} %. Разница в {{ ratio }} раза.
      </p>
    </div>

    <p class="mt-5 text-note text-prussian-100/50">
      1411 школ, реестр Минпросвещения. Год записан у 72,7 % записей, вид ремонта не указан.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * The one interactive thing on the landing, and it argues the product's case
 * rather than decorating it.
 *
 * A visitor moves one control and the same registry field yields 8.2 % or 61.1 %.
 * That is the actual measured spread from `GET /api/analytics/wear` on the loaded
 * school sample, not an illustration: the register stores a bare year and does not
 * say whether the repair was capital or routine.
 *
 * Figures are hard-coded here on purpose. The landing is server-rendered for people
 * who have never signed in, and a hero that waits on an API call is a hero that is
 * sometimes blank. They are dated in the copy and regenerated from the endpoint
 * whenever the sample changes.
 */
const HYPOTHESES = [
  {
    key: 'capital',
    button: 'Год - это капремонт',
    pct: 8.2,
    color: '#4E9A6B',
    reading:
      'Записанный год считается капитальным ремонтом и обнуляет отсчёт износа. Тогда фонд почти новый: медианное здание отремонтировано 8 лет назад.',
  },
  {
    key: 'current',
    button: 'Год - это любой ремонт',
    pct: 61.1,
    color: '#C4574A',
    reading:
      'Записанный год может быть текущим ремонтом и отсчёт не сбрасывает. Тогда возраст считается от постройки, и медианное здание прошло свой цикл.',
  },
] as const

const pick = ref<'capital' | 'current'>('capital')

const current = computed(() => HYPOTHESES.find((h) => h.key === pick.value)!)
const other = computed(() => HYPOTHESES.find((h) => h.key !== pick.value)!)
const ratio = computed(() => (61.1 / 8.2).toFixed(1))
</script>
