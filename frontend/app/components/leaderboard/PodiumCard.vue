<template>
  <div
    class="rounded-[1.5rem] border p-4 sm:p-5 flex flex-col items-center text-center transition-transform"
    :class="[
      featured
        ? 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 shadow-lg -translate-y-2'
        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm',
      isMe ? 'ring-2 ring-blue-400' : '',
    ]"
  >
    <div class="relative">
      <div
        class="rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-500 dark:text-slate-300"
        :class="featured ? 'w-20 h-20 text-xl' : 'w-16 h-16 text-base'"
      >
        {{ initials }}
      </div>
      <span
        class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white"
        :class="rankBadgeClass"
      >
        {{ entry.rank }}
      </span>
    </div>

    <p class="mt-3 font-black text-sm text-slate-800 dark:text-white truncate max-w-full">
      {{ entry.name }}
      <span v-if="isMe" class="text-[10px] text-blue-500 uppercase">(вы)</span>
    </p>
    <div class="flex items-center justify-center gap-3 mt-1 text-[11px] text-slate-400">
      <span class="flex items-center gap-1"><FileText :size="11" />{{ entry.issueCount }}</span>
      <span class="flex items-center gap-1"><CheckCircle2 :size="11" />{{ entry.verificationCount }}</span>
    </div>

    <div class="mt-3 px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30">
      <span class="text-sm font-black text-indigo-600 dark:text-indigo-300">{{ formatPoints(entry.points) }}</span>
      <span class="text-[10px] text-indigo-400 ml-1">очков</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { FileText, CheckCircle2 } from 'lucide-vue-next'
import type { LeaderboardEntry } from '~/types'

const props = defineProps<{ entry: LeaderboardEntry; isMe?: boolean; featured?: boolean }>()

const initials = computed(() =>
  props.entry.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join(''),
)
const rankBadgeClass = computed(() =>
  props.entry.rank === 1 ? 'bg-amber-500' : props.entry.rank === 2 ? 'bg-slate-400' : 'bg-orange-400',
)
const formatPoints = (n: number) => n.toLocaleString('ru-RU')
</script>
