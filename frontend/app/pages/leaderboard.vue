<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!entries.length" class="py-24 text-center text-body text-ink-muted dark:text-ink-faint">
      Нет данных
    </p>

    <template v-else>
      <SectionHead
        title="Рейтинг участников"
        eyebrow="Вклад"
        note="Очки начисляются за обращения и за проверки записей реестра. Порядок пересчитывается по запросу страницы."
      />

      <!-- Podium (top 3): rank 2 left, rank 1 center, rank 3 right -->
      <div class="mt-6 grid grid-cols-3 items-start gap-3 sm:gap-4">
        <PodiumCard v-if="podium[1]" :entry="podium[1]" :is-me="isMe(podium[1])" />
        <div v-else />
        <PodiumCard v-if="podium[0]" :entry="podium[0]" :is-me="isMe(podium[0])" featured />
        <div v-else />
        <PodiumCard v-if="podium[2]" :entry="podium[2]" :is-me="isMe(podium[2])" />
        <div v-else />
      </div>

      <!-- Rest of the ranking -->
      <div v-if="rest.length" class="mt-8">
        <p class="eyebrow">Весь рейтинг</p>
        <div class="panel mt-3 divide-y divide-rule dark:divide-night-rule">
          <div
            v-for="entry in visibleRest"
            :key="entry.id"
            class="flex items-center gap-4 px-4 py-3 transition-colors"
            :class="isMe(entry) ? 'bg-prussian-50 dark:bg-prussian-900/30' : ''"
          >
            <span
              class="w-8 shrink-0 text-center font-mono text-body"
              :class="isMe(entry) ? 'text-prussian-600 dark:text-prussian-200' : 'text-ink-faint'"
            >
              {{ entry.rank }}
            </span>
            <span
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-paper-sunk text-label font-semibold text-ink-muted dark:bg-night-sunk dark:text-ink-faint"
            >
              {{ initials(entry.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <p
                class="truncate text-body font-medium"
                :class="isMe(entry) ? 'text-prussian-700 dark:text-prussian-100' : 'text-ink dark:text-paper'"
              >
                {{ entry.name }}
                <span v-if="isMe(entry)" class="ml-1 text-label text-prussian-600 dark:text-prussian-200">(вы)</span>
              </p>
              <div class="mt-0.5 flex items-center gap-3 font-mono text-label text-ink-faint">
                <span class="flex items-center gap-1"><FileText :size="11" />{{ entry.issueCount }} обр.</span>
                <span class="flex items-center gap-1"><CheckCircle2 :size="11" />{{ entry.verificationCount }} пров.</span>
              </div>
            </div>
            <span class="shrink-0 font-mono text-body font-semibold text-ink dark:text-paper">
              {{ entry.points.toLocaleString('ru-RU') }}
              <span class="text-label font-normal text-ink-faint">очков</span>
            </span>
          </div>
        </div>

        <div v-if="visibleCount < rest.length" class="mt-5 flex justify-center">
          <button
            type="button"
            class="rounded-control border border-rule px-5 py-2.5 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:border-night-rule dark:text-ink-faint dark:hover:bg-night-sunk"
            @click="visibleCount += 10"
          >
            Показать ещё {{ Math.min(10, rest.length - visibleCount) }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2, FileText, CheckCircle2 } from 'lucide-vue-next'
import type { LeaderboardEntry } from '~/types'

// REWORKED to the register design system. Rows were rounded-2xl cards with their
// own borders stacked in a gap; they are a table of one column now, separated by
// hairlines, which is how the rest of the observatory sets a list.
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
