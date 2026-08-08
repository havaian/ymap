<template>
  <div class="bg-paper dark:bg-night">
    <!-- ── Hero ───────────────────────────────────────────────────────────────
         The plate is the thesis. Six thousand real coordinates draw the country
         on their own, because facilities follow settlement; nothing here is an
         illustration of data, it is the data. -->
    <section class="relative overflow-hidden bg-prussian-800 text-prussian-50">
      <div class="pointer-events-none absolute inset-0 opacity-[0.25]" :style="gridStyle" />

      <div class="absolute inset-0">
        <HeroMap />
      </div>

      <div class="pointer-events-none absolute inset-0 bg-gradient-to-r from-prussian-800 via-prussian-800/85 to-transparent" />

      <div class="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <div class="max-w-2xl">
          <p class="eyebrow text-prussian-200">Независимая обсерватория данных</p>
          <h1 class="mt-4 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.5rem]">
            Государство публикует состояние реестра. Историю не хранит никто.
          </h1>
          <p class="mt-6 max-w-xl text-lead text-prussian-100/75">
            Y.Map ведёт архив состояний государственных реестров социальной инфраструктуры Узбекистана
            и считает на нём то, что реестр сам о себе не говорит: где мест не хватает, где здание прошло
            свой срок, и какая цифра выдерживает решение, а какая нет.
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-3">
            <NuxtLink to="/map" class="inline-flex items-center gap-2 rounded-control bg-prussian-50 px-5 py-3 text-body font-semibold text-prussian-800 transition-colors hover:bg-white">
              <MapPin :size="16" />
              Открыть карту
            </NuxtLink>
            <NuxtLink to="/analytics/data-quality" class="inline-flex items-center gap-2 rounded-control border border-prussian-200/30 px-5 py-3 text-body font-medium text-prussian-50 transition-colors hover:bg-prussian-200/10">
              Отчёт о качестве данных
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Counters read across the bottom of the plate rather than sitting in
           cards: they are the caption to the map above them. -->
      <div class="relative border-t border-prussian-200/15">
        <dl class="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 lg:grid-cols-4">
          <div v-for="s in heroStats" :key="s.label" class="py-5 pr-6">
            <dd class="font-display text-h2 font-semibold tabular text-prussian-50">{{ s.value }}</dd>
            <dt class="mt-1 text-label text-prussian-100/60">{{ s.label }}</dt>
          </div>
        </dl>
      </div>
    </section>

    <!-- ── What the archive is ───────────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,20rem)_1fr]">
        <div>
          <p class="eyebrow">Актив</p>
          <h2 class="mt-3 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
            Снимок, который завтра уже не снять
          </h2>
        </div>
        <div>
          <p class="max-w-2xl text-lead text-ink-muted dark:text-ink-faint">
            Порталы открытых данных публикуют текущее состояние реестра и перезаписывают его при обновлении.
            Что стояло в поле год назад, не знает никто, и восстановить это задним числом нельзя.
            Архив снимков решает ровно эту задачу: он хранит сырые байты выгрузки и превращает
            последовательность состояний в переходы.
          </p>

          <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div v-for="(step, i) in archiveSteps" :key="step.title" class="border-t border-rule pt-4 dark:border-night-rule">
              <!-- Numbered because this actually is a sequence: a snapshot cannot
                   be diffed before a second one exists. -->
              <p class="font-mono text-label text-ink-faint">{{ String(i + 1).padStart(2, '0') }}</p>
              <p class="mt-2 font-medium text-ink dark:text-paper">{{ step.title }}</p>
              <p class="mt-1 text-note text-ink-muted dark:text-ink-faint">{{ step.body }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ── The interactive argument ──────────────────────────────────────── -->
    <section class="bg-prussian-800 text-prussian-50">
      <div class="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
        <div>
          <p class="eyebrow text-prussian-200">Одно поле, два прочтения</p>
          <h2 class="mt-3 font-display text-h1 font-semibold tracking-tight">
            Реестр не говорит, какой это был ремонт
          </h2>
          <p class="mt-5 max-w-lg text-lead text-prussian-100/70">
            В школьной форме стоит голый год. Капитальный он или текущий, поле не различает,
            а от ответа зависит, считать ли фонд почти новым или прошедшим свой срок.
            В реестре Минздрава виды ремонта уже разделены. Переключите и посмотрите, что стоит на кону.
          </p>
          <p class="mt-5 max-w-lg text-body text-prussian-100/60">
            Мы не выбираем одну гипотезу за читателя. Обе публикуются, обе видны, и разрыв между ними
            закрывается одной строкой в форме, а не лучшей моделью.
          </p>
        </div>
        <div class="lg:pt-10">
          <HypothesisToggle />
        </div>
      </div>
    </section>

    <!-- ── What is computed ──────────────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <p class="eyebrow">Что считается сегодня</p>
      <h2 class="mt-3 max-w-2xl font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
        Четыре измерения на данных, которые уже загружены
      </h2>

      <div class="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <NuxtLink
          v-for="m in models"
          :key="m.to"
          :to="m.to"
          class="panel group p-6 transition-colors hover:border-prussian-300 dark:hover:border-prussian-500"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="eyebrow">{{ m.eyebrow }}</p>
              <h3 class="mt-2 font-display text-h3 font-semibold text-ink dark:text-paper">{{ m.title }}</h3>
            </div>
            <ArrowUpRight :size="18" class="shrink-0 text-ink-faint transition-colors group-hover:text-prussian-500" />
          </div>
          <p class="mt-3 text-body text-ink-muted dark:text-ink-faint">{{ m.body }}</p>
          <div class="mt-5 flex items-baseline gap-2 border-t border-rule pt-4 dark:border-night-rule">
            <span class="font-display text-h2 font-semibold tabular text-ink dark:text-paper">{{ m.figure }}</span>
            <span class="text-note text-ink-faint">{{ m.figureLabel }}</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- ── The rule ──────────────────────────────────────────────────────── -->
    <section class="border-y border-rule bg-paper-sunk dark:border-night-rule dark:bg-night-sunk">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div class="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,20rem)_1fr]">
          <div>
            <p class="eyebrow">Правило</p>
            <h2 class="mt-3 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
              Ни одного числа без знаменателя
            </h2>
          </div>
          <ul class="space-y-5">
            <li v-for="r in rules" :key="r.title" class="border-t border-rule pt-4 dark:border-night-rule">
              <p class="font-medium text-ink dark:text-paper">{{ r.title }}</p>
              <p class="mt-1 max-w-2xl text-body text-ink-muted dark:text-ink-faint">{{ r.body }}</p>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- ── Close ─────────────────────────────────────────────────────────── -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div class="panel flex flex-wrap items-center justify-between gap-6 p-8">
        <div class="max-w-xl">
          <h2 class="font-display text-h2 font-semibold tracking-tight text-ink dark:text-paper">
            Знаете объект вживую? Уточните запись
          </h2>
          <p class="mt-2 text-body text-ink-muted dark:text-ink-faint">
            Очередь верификации показывает, какая запись реестра сейчас стоит проверки и почему.
            Часть заданий выдаётся жребием, и это видно в интерфейсе.
          </p>
        </div>
        <NuxtLink to="/analytics/verification" class="inline-flex items-center gap-2 rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700">
          Открыть очередь
          <ArrowUpRight :size="16" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { MapPin, ArrowUpRight } from 'lucide-vue-next'

// Public landing, server-rendered: the layout has the marketing header and footer,
// not the application shell.
definePageMeta({ layout: 'default' })
useSeoMeta({
  title: 'Y.Map - обсерватория данных о социальной инфраструктуре Узбекистана',
  description:
    'Архив состояний государственных реестров школ, детских садов и ФАП. Дефицит мест, износ зданий, индекс депривации и очередь верификации - с указанием знаменателя у каждой цифры.',
})

// A blueprint grid, drawn rather than imported: this is the material world of the
// subject, and a background image would be one more asset to keep in sync.
const gridStyle = {
  backgroundImage:
    'linear-gradient(to right, rgba(143,197,232,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(143,197,232,0.18) 1px, transparent 1px)',
  backgroundSize: '48px 48px',
}

// Every figure here is computed, not written: see the amendments document for the
// runs behind each one. The date is what makes them quotable.
const heroStats = [
  { value: '27 102', label: 'объектов с проверенной координатой' },
  { value: '2 198', label: 'записей реестров загружено' },
  { value: '178', label: 'районов в покрытии' },
  { value: '54,6 %', label: 'школ выше проектной мощности' },
]

const archiveSteps = [
  {
    title: 'Снимок',
    body: 'Сырые байты выгрузки складываются в архив без разбора. Позднейшая правка логики импорта применяется ко всей истории задним числом.',
  },
  {
    title: 'Дифф',
    body: 'Пара снимков даёт переходы полей. Изменение произошло внутри окна между ними, и архив сузить его не может.',
  },
  {
    title: 'Модель',
    body: 'Переходы состояний - это интервально-цензурированные данные. Модель износа на них нельзя ускорить деньгами, только временем.',
  },
]

const models = [
  {
    to: '/analytics/capacity',
    eyebrow: 'М1',
    title: 'Дефицит мест',
    body: 'Три числа на три решения: сверх одной смены, сверх фактических смен и сверх двух смен. Последнее второй сменой уже не решается.',
    figure: '7 998',
    figureLabel: 'мест сверх двух смен',
  },
  {
    to: '/analytics/wear',
    eyebrow: 'М2',
    title: 'Износ зданий',
    body: 'Нормативный учёт под двумя прочтениями поля ремонта. Обе границы публикуются, выбор гипотезы остаётся за читателем.',
    figure: '8,2 – 61,1 %',
    figureLabel: 'за пределом цикла',
  },
  {
    to: '/analytics/deprivation',
    eyebrow: 'Индекс',
    title: 'Депривация',
    body: 'Метод Алкире-Фостера, тот же счётный подход, что в глобальном ИМБ. Композит никогда не показывается без разложения по измерениям.',
    figure: '0,181 – 0,196',
    figureLabel: 'M0 по школам',
  },
  {
    to: '/analytics/verification',
    eyebrow: 'М4',
    title: 'Очередь верификации',
    body: 'Какая запись стоит полевой проверки и почему. Часть очереди выдаётся жребием, механизм отбора записывается на диск.',
    figure: '25 %',
    figureLabel: 'случайная доля очереди',
  },
]

const rules = [
  {
    title: 'При каждой цифре стоит знаменатель и дата среза',
    body: 'Оценка по неполной выборке помечается как оценка по неполной выборке. Загруженные 1411 школ - это около 17,6 % реестра, и на страну они не экстраполируются.',
  },
  {
    title: 'Интервал не сворачивается в середину',
    body: 'Там, где данные не позволяют назвать точку, публикуются обе границы. Усреднённый интервал перестаёт быть интервалом.',
  },
  {
    title: 'Тон консультативный',
    body: 'Отчёты измеряют, какое решение выдерживает поле реестра, и называют поле, которое закрывает разрыв. Оценок достоверности ведомственных данных они не содержат.',
  },
  {
    title: 'Открытое ядро',
    body: 'Harvester, схема данных, дифф-движок и сведённый слой координат открыты. Слой принятия решений - коммерческий.',
  },
]
</script>
