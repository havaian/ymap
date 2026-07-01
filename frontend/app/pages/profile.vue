<template>
  <div class="mx-auto max-w-3xl px-4 sm:px-6 py-6">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="w-8 h-8 animate-spin text-blue-600" />
    </div>

    <!-- Error -->
    <p v-else-if="!d" class="text-center text-sm text-slate-400 py-24">
      Не удалось загрузить профиль
    </p>

    <template v-else>
      <!-- Hero card -->
      <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div class="h-24 bg-gradient-to-r from-blue-600 to-indigo-600" />
        <div class="px-6 pb-6">
          <div class="-mt-10 mb-4 flex items-end justify-between">
            <div class="w-20 h-20 rounded-[1.5rem] bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-900 shadow-lg flex items-center justify-center text-3xl">
              {{ level.icon }}
            </div>
            <span class="text-xs font-black px-3 py-1.5 rounded-full" :class="[level.bg, level.color]">
              {{ level.label }}
            </span>
          </div>
          <h2 class="text-2xl font-black text-slate-800 dark:text-white">{{ d.user.name }}</h2>
          <div class="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1">
              <Calendar :size="13" />
              {{ joinedDate }}
            </span>
            <span class="flex items-center gap-1 font-bold text-amber-500">
              <Star :size="13" />
              {{ points }} очков
            </span>
          </div>

          <div v-if="nextLevel" class="mt-4">
            <div class="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
              <span>{{ level.label }}</span>
              <span>{{ nextLevel.label }} через {{ nextLevel.min - points }} оч.</span>
            </div>
            <div class="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full transition-[width] duration-300" :style="{ width: progress + '%' }" />
            </div>
          </div>
          <p v-else class="mt-3 text-xs font-bold text-emerald-500">🏆 Максимальный уровень достигнут!</p>
        </div>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-3 mt-5">
        <div v-for="s in stats" :key="s.label" class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div class="flex items-center gap-2 mb-2">
            <component :is="s.icon" :size="16" :class="s.iconClass" />
            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">{{ s.label }}</span>
          </div>
          <p class="text-3xl font-black text-slate-800 dark:text-white">{{ s.value }}</p>
          <p class="text-[11px] text-slate-400 mt-1">{{ s.sub }}</p>
        </div>
      </div>

      <!-- Badges -->
      <div class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 mt-5">
        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
          Достижения ({{ earnedBadges.length }}/{{ BADGES.length }})
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div v-for="b in allBadges" :key="b.id" class="flex flex-col items-center text-center gap-2">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center"
              :class="b.earned ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'"
            >
              <component :is="b.earned ? b.icon : LockIcon" :size="20" />
            </div>
            <span class="text-[11px] font-bold leading-tight" :class="b.earned ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'">
              {{ b.label }}
            </span>
          </div>
        </div>
      </div>

      <!-- Recent issues -->
      <div v-if="d.activity.recentIssues.length" class="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 p-6 mt-5">
        <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Последние обращения</h3>
        <div class="space-y-2">
          <div v-for="issue in d.activity.recentIssues" :key="issue.id" class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{{ issue.title }}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="text-[10px] text-slate-400">{{ categoryShort(issue.category) }}</span>
                <span class="text-[10px] font-bold" :class="statusClass(issue.status)">{{ statusLabel(issue.status) }}</span>
              </div>
            </div>
            <span class="text-[10px] text-slate-400 flex-shrink-0">{{ formatDate(issue.createdAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  Loader2, Calendar, Star, FileText, ThumbsUp, CheckCircle2, TrendingUp,
  Flag, ShieldCheck, Shield, Zap, Award, Crown, Lock as LockIcon,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { ProfileData } from '~/types'

definePageMeta({
  layout: 'app',
  middleware: 'auth',
  pageTitle: 'Профиль',
  pageSubtitle: 'Данные о пользователе',
})
useSeoMeta({ title: 'Профиль - Y.Map' })

const { $api } = useNuxtApp()
const data = ref<ProfileData | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await $api<{ success: boolean; data: ProfileData }>('/users/me/activity')
    data.value = res.data
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
})

const { BADGES, getLevel, getNextLevel, getProgress } = useGamification()

const d = computed(() => data.value)
const points = computed(() => d.value?.user.points ?? 0)
const level = computed(() => getLevel(points.value))
const nextLevel = computed(() => getNextLevel(points.value))
const progress = computed(() => getProgress(points.value))

const joinedDate = computed(() =>
  d.value ? new Date(d.value.user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '',
)

// Badge id -> icon (labels/criteria come from useGamification; icons chosen to match the mockup).
const BADGE_ICONS: Record<string, Component> = {
  first_issue: Flag,
  first_verif: ShieldCheck,
  five_issues: FileText,
  first_resolve: Award,
  ten_verifs: Shield,
  activist: Zap,
  district_leader: Crown,
  expert: Star,
}

const badgeCtx = computed(() => (d.value ? { activity: d.value.activity, points: d.value.user.points } : null))
const earnedBadges = computed(() => (badgeCtx.value ? BADGES.filter((b) => b.check(badgeCtx.value!)) : []))
const allBadges = computed(() =>
  BADGES.map((b) => ({
    id: b.id,
    label: b.label,
    icon: BADGE_ICONS[b.id] ?? Award,
    earned: badgeCtx.value ? b.check(badgeCtx.value) : false,
  })),
)

const stats = computed(() => {
  const a = d.value?.activity
  if (!a) return []
  return [
    { label: 'Обращения', value: a.issues.total, icon: FileText, iconClass: 'text-blue-500', sub: `Решено: ${a.issues.resolved}` },
    { label: 'Голоса', value: a.votesGiven, icon: ThumbsUp, iconClass: 'text-violet-500', sub: 'Отдано за чужие обращения' },
    { label: 'Проверки', value: a.verifications.done + a.verifications.problem, icon: CheckCircle2, iconClass: 'text-teal-500', sub: `Подтвердил: ${a.verifications.done} · Оспорил: ${a.verifications.problem}` },
    { label: 'Признание', value: a.issues.totalVotes, icon: TrendingUp, iconClass: 'text-amber-500', sub: 'Голосов получено' },
  ]
})

const CATEGORY_SHORT: Record<string, string> = {
  Roads: 'Дороги',
  'Water & Sewage': 'Вода',
  Electricity: 'Электр.',
  'Schools & Kindergartens': 'Образов.',
  'Hospitals & Clinics': 'Здравоохр.',
  'Waste Management': 'Мусор',
  Other: 'Прочее',
}
const categoryShort = (c: string) => CATEGORY_SHORT[c] ?? c
const statusLabel = (s: string) => (s === 'Resolved' ? 'Решено' : s === 'In Progress' ? 'В работе' : 'Открыто')
const statusClass = (s: string) =>
  s === 'Resolved' ? 'text-emerald-500' : s === 'In Progress' ? 'text-amber-500' : 'text-red-500'
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')
</script>
