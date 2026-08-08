<template>
  <span
    class="inline-flex shrink-0 items-center justify-center rounded-control bg-prussian-600 text-paper"
    :style="{ width: box, height: box }"
    aria-hidden="true"
  >
    <svg :width="glyph" :height="glyph" viewBox="0 0 24 24" fill="none">
      <!-- Three district cells and a plotted point. The mark says what the product
           is - a register of measured places - instead of a folded paper map, which
           is what every mapping product uses and what the lucide icon here drew.
           Strokes only, so it holds at 16 px in the sidebar and at 48 px as a
           favicon without a second file. -->
      <path
        d="M3.2 6.6 9 4.2v13.2l-5.8 2.4V6.6Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <path
        d="M9 4.2 15 6.6v13.2L9 17.4V4.2Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        :opacity="0.55"
      />
      <path
        d="M15 6.6 20.8 4.2v13.2L15 19.8V6.6Z"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linejoin="round"
        :opacity="0.3"
      />
      <circle cx="12" cy="11.6" r="1.9" fill="currentColor" />
    </svg>
  </span>
</template>

<script setup lang="ts">
// One mark, one file. The header, the sidebar, the sign-in card and the favicon
// were three lucide glyphs and a gradient rectangle from the old palette; they
// had already drifted apart in size and colour.
const props = withDefaults(defineProps<{ size?: number }>(), { size: 36 })

const box = computed(() => `${props.size}px`)
const glyph = computed(() => Math.round(props.size * 0.58))
</script>
