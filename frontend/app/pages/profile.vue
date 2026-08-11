<template>
  <div class="mx-auto max-w-4xl px-4 py-6 sm:px-6">
    <div v-if="loading" class="flex items-center justify-center py-24">
      <Loader2 class="h-7 w-7 animate-spin text-prussian-500" />
    </div>

    <p v-else-if="!d" class="py-24 text-center text-body text-ink-muted dark:text-ink-faint">
      Профиль не загрузился
    </p>

    <template v-else>
      <!-- Запись об участнике. Уровень, очки и значки сняты: вклад в обсерваторию
           измеряется проверенными записями реестра, а не набранной суммой, и
           игровая шкала спорит с консультативным тоном остальной платформы.
           Файл composables/useGamification.ts не удалён - он остаётся для
           рейтинга, который живёт своей страницей. -->
      <section class="panel p-6">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="eyebrow">Аккаунт</p>
            <h1 class="mt-1 truncate font-display text-h2 font-semibold tracking-tight text-ink dark:text-paper">
              {{ displayName }}
            </h1>
            <p class="mt-1 text-note text-ink-muted dark:text-ink-faint">
              В проекте с {{ joinedDate }}
            </p>
          </div>
          <span class="rounded-control bg-paper-sunk px-3 py-1.5 text-label font-semibold text-ink-muted dark:bg-night-sunk dark:text-ink-faint">
            {{ roleLabel }}
          </span>
        </div>

        <p v-if="!d.user.name" class="mt-5 border-t border-rule pt-4 text-note text-ink-muted dark:border-night-rule dark:text-ink-faint">
          Имя не указано. Регистрация его не спрашивает, поэтому в подписи стоит адрес почты.
        </p>
      </section>

      <!-- Счёт вклада. У каждого числа стоит то, из чего оно сложено. -->
      <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatPanel
          v-for="s in stats"
          :key="s.label"
          :label="s.label"
          :value="s.value"
          :denominator="s.sub"
        />
      </div>

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

      <NoteBlock class="mt-4" title="Что здесь считается">
        Проверки - это подтверждённые и оспоренные поля конкретных записей реестра. Обращения и
        голоса приходят с гражданского контура и наполняются по мере его работы. Очки и уровни
        на этой странице не показываются: они ничего не говорят о том, стала ли запись точнее.
      </NoteBlock>
    </template>
  </div>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import type { ProfileData } from '~/types'

// ПЕРЕДЕЛАНО под концепцию обсерватории. Со страницы сняты уровень, шкала очков
// до следующего уровня и сетка значков: это игровая механика, а платформа
// измеряет соответствие реестра полю. Числа остались те же и приходят из того же
// /users/me/activity - изменилось, что именно вынесено вперёд.
definePageMeta({
  layout: 'app',
  middleware: 'auth',
  pageTitle: 'Профиль',
  pageSubtitle: 'Запись об участнике и его вклад',
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

const d = computed(() => data.value)

// Имя необязательно. Пустое подменяется адресом только в подписи собственного
// профиля - это свой адрес, и никому больше он не показывается.
const displayName = computed(() => d.value?.user.name || d.value?.user.email || '-')

const roleLabel = computed(() => (d.value?.user.role === 'ADMIN' ? 'Оператор' : 'Участник'))

const joinedDate = computed(() =>
  d.value ? new Date(d.value.user.createdAt).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '',
)

const stats = computed(() => {
  const a = d.value?.activity
  if (!a) return []
  return [
    {
      label: 'Проверки записей',
      value: a.verifications.done + a.verifications.problem,
      sub: `Подтверждено ${a.verifications.done}, оспорено ${a.verifications.problem}`,
    },
    { label: 'Обращения', value: a.issues.total, sub: `Решено ${a.issues.resolved}` },
    { label: 'Голоса за чужие обращения', value: a.votesGiven, sub: 'Отдано' },
    { label: 'Голоса за свои обращения', value: a.issues.totalVotes, sub: 'Получено' },
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
