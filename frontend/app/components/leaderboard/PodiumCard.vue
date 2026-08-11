<template>
  <div
    class="panel flex flex-col items-center p-4 text-center sm:p-5"
    :class="[
      featured ? 'border-prussian-300 dark:border-prussian-500' : '',
      isMe ? 'ring-1 ring-prussian-500' : '',
    ]"
  >
    <div class="relative">
      <span
        class="flex items-center justify-center rounded-control bg-paper-sunk font-display font-semibold text-ink-muted dark:bg-night-sunk dark:text-ink-faint"
        :class="featured ? 'h-16 w-16 text-h3' : 'h-14 w-14 text-lead'"
      >
        {{ initials }}
      </span>
      <!-- Rank sits on the mark rather than beside it, because the three cards are
           read as a group and the number is what distinguishes them. -->
      <span
        class="absolute -bottom-1.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full font-mono text-label font-semibold text-paper"
        :style="{ backgroundColor: rankColor }"
      >
        {{ entry.rank }}
      </span>
    </div>

    <p class="mt-4 max-w-full truncate text-body font-medium text-ink dark:text-paper">
      {{ entry.name || 'Без имени' }}
      <span v-if="isMe" class="text-label text-prussian-600 dark:text-prussian-200">(вы)</span>
    </p>

    <div class="mt-1 flex items-center justify-center gap-3 font-mono text-label text-ink-faint">
      <span class="flex items-center gap-1"><FileText :size="11" />{{ entry.issueCount }}</span>
      <span class="flex items-center gap-1"><CheckCircle2 :size="11" />{{ entry.verificationCount }}</span>
    </div>

    <div class="mt-4 w-full border-t border-rule pt-3 dark:border-night-rule">
      <MeasuredValue :value="entry.points" unit="очков" :size="featured ? 'lg' : 'md'" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileText, CheckCircle2 } from 'lucide-vue-next'
import type { LeaderboardEntry } from '~/types'

// REWORKED. The card was rounded-[1.5rem] with shadow-lg, an amber ring on first
// place, an indigo pill under the points and `-translate-y-2` lifting the winner
// out of the row. The lift is dropped: the podium is already ordered left to right
// and a card that floats above its neighbours reads as a hover state.
const props = defineProps<{ entry: LeaderboardEntry; isMe?: boolean; featured?: boolean }>()

const { SCALE_COLORS } = useScale()

const initials = computed(() =>
  (props.entry.name || '?').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join(''),
)

// Three steps down the accent, not gold/silver/bronze: the ramp is reserved for
// deficiency and must not be spent on decoration.
const rankColor = computed(() =>
  props.entry.rank === 1 ? '#14415C' : props.entry.rank === 2 ? '#2A6082' : '#4A7F9F',
)
</script>
