<template>
  <!-- Узкий экран: подпись отдельной строкой над полосой. Широкий: та же строка,
       что и была. -->
  <div class="flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
    <span
      v-if="label"
      class="sb-label truncate text-body text-ink-muted dark:text-ink-faint"
      :style="{ '--label-w': labelWidth }"
    >
      {{ label }}
    </span>

    <div class="flex flex-1 items-center gap-3">
      <span class="span-track flex-1">
        <!-- Upper bound first and faded: what the value could be if the missing field
             went the other way. The solid bar is what the data actually supports. -->
        <span v-if="hasBand" class="span-upper" :style="{ width: pct(upper), background: color }" />
        <span class="span-lower" :style="{ width: pct(lower), background: color }" />
      </span>

      <span
        class="sb-value shrink-0 whitespace-nowrap text-right text-body tabular text-ink dark:text-paper"
        :style="{ '--value-w': valueWidth }"
      >
        {{ text }}
      </span>
    </div>
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
 *
 * ПЕРЕДЕЛАНО под узкий экран. Подпись и значение стояли в одной строке с полосой
 * и имели твёрдую ширину: 11rem и 7rem. На телефоне в 360 px внутри панели
 * остаётся около 280 px, и одни только эти две колонки с промежутками занимали
 * 312 px - полоса схлопывалась в ноль, а строка уезжала за край панели. Полоса
 * при этом и есть содержание компонента.
 *
 * Твёрдые ширины сохранены, но включаются с md. До него подпись занимает
 * отдельную строку над полосой, а значение прижато к её правому краю и меряется
 * по содержимому. Порог именно md, а не sm: в data-quality.vue примечания под
 * полосой отбиты классом md:ml-[11.75rem] ровно под эту колонку, и разные пороги
 * дали бы разъезд подписи с примечанием на промежуточной ширине.
 *
 * Ширины приходят как переменные CSS, а не как inline-стиль: inline-стиль
 * применяется на всех ширинах сразу и медиазапросом не отменяется.
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

<style scoped>
/* До md обе колонки меряются по содержимому: подпись занимает свою строку,
   значение прижато к правому краю полосы. */
.sb-label {
  width: 100%;
}
.sb-value {
  width: auto;
}

@media (min-width: 768px) {
  .sb-label {
    width: var(--label-w);
    flex-shrink: 0;
  }
  .sb-value {
    width: var(--value-w);
  }
}
</style>
