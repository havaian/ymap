<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!d" class="py-24 text-center text-body text-ink-muted dark:text-ink-faint">
      Не удалось загрузить профиль
    </p>

    <template v-else>
      <!-- Identity. The gradient banner and the floating avatar tile are gone: this
           is a record about a contributor, and a header image says nothing about it. -->
      <section class="panel p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="eyebrow">Участник</p>
            <h1 class="mt-1 font-display text-h2 font-semibold tracking-tight text-ink dark:text-paper">
              {{ d.user.name }}
            </h1>
            <p class="mt-1 text-note text-ink-muted dark:text-ink-faint">
              В проекте с {{ joinedDate }}
            </p>
          </div>
          <span class="rounded-control px-3 py-1.5 text-label font-semibold" :class="[level.bg, level.color]">
            {{ level.icon }} {{ level.label }}
          </span>
        </div>

        <div class="mt-6 border-t border-rule pt-5 dark:border-night-rule">
          <div class="flex items-baseline justify-between gap-4">
            <MeasuredValue :value="points" unit="очков" size="lg" />
            <p v-if="nextLevel" class="text-note text-ink-muted dark:text-ink-faint">
              До «{{ nextLevel.label }}» {{ nextLevel.min - points }}
            </p>
            <p v-else class="text-note" :style="{ color: SCALE_COLORS.ok }">Максимальный уровень</p>
          </div>

          <!-- The same span primitive the observatory pages use for a bound: the
               filled part is what is earned, the light continuation is what the
               next level needs. -->
          <div v-if="nextLevel" class="span-track mt-3">
            <div class="span-upper w-full" :style="{ backgroundColor: SCALE_COLORS.ok }" />
            <div class="span-lower" :style="{ width: progress + '%', backgroundColor: SCALE_COLORS.ok }" />
          </div>
          <div v-if="nextLevel" class="mt-1.5 flex justify-between text-label text-ink-faint">
            <span>{{ level.label }}</span>
            <span class="font-mono">{{ level.min }} – {{ nextLevel.min }}</span>
          </div>
        </div>
      </section>

      <!-- Counts, each with what it is counted out of. -->
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatPanel
          v-for="s in stats"
          :key="s.label"
          :label="s.label"
          :value="s.value"
          :denominator="s.sub"
        />
      </div>

      <section class="panel mt-4 p-6">
        <SectionHead
          title="Достижения"
          eyebrow="Отметки"
          :note="`Открыто ${earnedBadges.length} из ${BADGES.length}. Два критерия пока не имеют источника данных и заперты.`"
        />
        <div class="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div v-for="b in allBadges" :key="b.id" class="flex flex-col items-center gap-2 text-center">
            <span
              class="flex h-12 w-12 items-center justify-center rounded-control"
              :class="b.earned
                ? 'bg-prussian-600 text-paper'
                : 'bg-paper-sunk text-ink-faint dark:bg-night-sunk'"
            >
              <component :is="b.earned ? b.icon : LockIcon" :size="18" />
            </span>
            <span
              class="text-label leading-tight"
              :class="b.earned ? 'text-ink dark:text-paper' : 'text-ink-faint'"
            >
              {{ b.label }}
            </span>
          </div>
        </div>
      </section>

      <section v-if="d.activity.recentIssues.length" class="panel mt-4 p-6">
        <SectionHead title="Последние обращения" eyebrow="История" />
        <div class="mt-4 divide-y divide-rule dark:divide-night-rule">
          <div
            v-for="issue in d.activity.recentIssues"
            :key="issue.id"
            class="flex items-center gap-3 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-body font-medium text-ink dark:text-paper">{{ issue.title }}</p>
              <div class="mt-0.5 flex items-center gap-2 text-label text-ink-faint">
                <span>{{ categoryShort(issue.category) }}</span>
                <span :style="{ color: statusColor(issue.status) }">{{ statusLabel(issue.status) }}</span>
              </div>
            </div>
            <span class="shrink-0 font-mono text-label text-ink-faint">{{ formatDate(issue.createdAt) }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import {
  Loader2, Star, FileText, ThumbsUp, CheckCircle2, TrendingUp,
  Flag, ShieldCheck, Shield, Zap, Award, Crown, Lock as LockIcon,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import type { ProfileData } from '~/types'

// REWORKED to the register design system. The page was built on the stock palette:
// a blue-to-indigo banner, rounded-[2rem] cards, font-black on every figure and one
// emerald "🏆 Максимальный уровень достигнут!" line. The numbers themselves did not
// change - only how they are set, and the level bar now uses the same span
// primitive as every bound in the observatory section.
definePageMeta({
  layout: 'app',
  middleware: 'auth',
  pageTitle: 'Профиль',
  pageSubtitle: 'Данные о пользователе',
})
useSeoMeta({ title: 'Профиль - Y.Map' })

const { $api } = useNuxtApp()
const { SCALE_COLORS } = useScale()
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
    { label: 'Обращения', value: a.issues.total, icon: FileText, sub: `Решено: ${a.issues.resolved}` },
    { label: 'Голоса', value: a.votesGiven, icon: ThumbsUp, sub: 'Отдано за чужие обращения' },
    {
      label: 'Проверки',
      value: a.verifications.done + a.verifications.problem,
      icon: CheckCircle2,
      sub: `Подтвердил: ${a.verifications.done} · Оспорил: ${a.verifications.problem}`,
    },
    { label: 'Признание', value: a.issues.totalVotes, icon: TrendingUp, sub: 'Голосов получено' },
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
// Status reads off the same ramp as everything else: resolved is sufficient,
// open is not, in progress sits between them.
const statusColor = (s: string) =>
  s === 'Resolved' ? SCALE_COLORS.ok : s === 'In Progress' ? SCALE_COLORS.mild : SCALE_COLORS.bad
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ru-RU')
</script>
