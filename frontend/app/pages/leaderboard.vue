<template>
  <div class="mx-auto max-w-4xl px-4 sm:px-6 py-6">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-600" />
    </div>

    <p v-else-if="!entries.length" class="text-center text-sm text-slate-400 py-24">Нет данных</p>

    <template v-else>
      <!-- Podium (top 3): rank 2 left, rank 1 center elevated, rank 3 right -->
      <div class="grid grid-cols-3 gap-3 sm:gap-4 items-end mb-8">
        <PodiumCard v-if="podium[1]" :entry="podium[1]" :is-me="isMe(podium[1])" />
        <div v-else />
        <PodiumCard v-if="podium[0]" :entry="podium[0]" :is-me="isMe(podium[0])" featured />
        <div v-else />
        <PodiumCard v-if="podium[2]" :entry="podium[2]" :is-me="isMe(podium[2])" />
        <div v-else />
      </div>

      <!-- Rest of the ranking -->
      <div v-if="rest.length">
        <p class="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Весь рейтинг</p>
        <div class="space-y-3">
          <div
            v-for="entry in visibleRest"
            :key="entry.id"
            class="rounded-2xl border p-4 flex items-center gap-4 transition-colors"
            :class="isMe(entry)
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'"
          >
            <span class="w-8 text-center text-lg font-black flex-shrink-0" :class="isMe(entry) ? 'text-blue-600' : 'text-slate-400'">
              {{ entry.rank }}
            </span>
            <span class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-500 dark:text-slate-300 flex-shrink-0">
              {{ initials(entry.name) }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="font-black text-sm truncate" :class="isMe(entry) ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-white'">
                {{ entry.name }}
                <span v-if="isMe(entry)" class="ml-1 text-[10px] font-black text-blue-500 uppercase tracking-wider">(вы)</span>
              </p>
              <div class="flex items-center gap-3 mt-0.5 text-[11px] text-slate-400">
                <span class="flex items-center gap-1"><FileText :size="11" />{{ entry.issueCount }} обр.</span>
                <span class="flex items-center gap-1"><CheckCircle2 :size="11" />{{ entry.verificationCount }} пров.</span>
              </div>
            </div>
            <div class="px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 flex-shrink-0">
              <span class="text-sm font-black text-slate-700 dark:text-slate-200">{{ entry.points }}</span>
              <span class="text-[10px] text-slate-400 ml-1">очков</span>
            </div>
          </div>
        </div>

        <div v-if="visibleCount < rest.length" class="flex justify-center mt-6">
          <button
            type="button"
            class="px-5 py-2.5 rounded-full text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            @click="visibleCount += 10"
          >
            Показать еще
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2, FileText, CheckCircle2 } from 'lucide-vue-next'
import type { LeaderboardEntry } from '~/types'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
  pageTitle: 'Лидерборд',
  pageSubtitle: 'Самые активные граждане',
})
useSeoMeta({ title: 'Лидерборд - Y.Map' })

const { $api } = useNuxtApp()
const { user } = useAuth()

const entries = ref<LeaderboardEntry[]>([])
const loading = ref(true)
const visibleCount = ref(10)

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: LeaderboardEntry[] }>('/users/leaderboard')
    entries.value = res.data
  } catch {
    entries.value = []
  } finally {
    loading.value = false
  }
})

const podium = computed(() => entries.value.slice(0, 3))
const rest = computed(() => entries.value.slice(3))
const visibleRest = computed(() => rest.value.slice(0, visibleCount.value))

const isMe = (e: LeaderboardEntry) => !!user.value && e.id === user.value.id
const initials = (name: string) =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
</script>
