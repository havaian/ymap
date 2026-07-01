<template>
  <div>
    <!-- Hero -->
    <section class="relative overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 text-white">
      <div class="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_70%_20%,#3b82f6,transparent_45%)]" />
      <div class="relative mx-auto max-w-7xl px-4 sm:px-6 py-20 sm:py-28">
        <p class="text-xs font-black uppercase tracking-widest text-blue-300 mb-4">Государственные программы</p>
        <h1 class="text-4xl sm:text-6xl font-black tracking-tight leading-[1.05] max-w-3xl">
          Стратегия «Узбекистан - 2030»
        </h1>
        <p class="mt-6 text-base sm:text-lg text-slate-300 max-w-xl">
          Сообщайте о проблемах. Влияйте на изменения. Следите за результатами.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <NuxtLink
            to="/map"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <ShieldCheck :size="18" />
            Проверить объект
          </NuxtLink>
          <NuxtLink
            to="/login"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-slate-900 bg-white hover:bg-slate-100 transition-colors"
          >
            Войти
          </NuxtLink>
        </div>
        <div class="mt-10 flex flex-wrap gap-3">
          <span
            v-for="chip in heroChips"
            :key="chip"
            class="px-5 py-2.5 rounded-2xl text-sm font-bold bg-white/10 backdrop-blur border border-white/10"
          >
            {{ chip }}
          </span>
        </div>
      </div>
    </section>

    <!-- How it works -->
    <section class="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
      <div class="text-center max-w-2xl mx-auto">
        <h2 class="text-3xl sm:text-4xl font-black tracking-tight">Как это работает?</h2>
        <p class="mt-3 text-slate-500 dark:text-slate-400">
          Граждане помогают государству измерять реальные результаты реформ
        </p>
      </div>
      <div class="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="step in steps"
          :key="step.n"
          class="bg-white dark:bg-slate-900 rounded-[1.75rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm"
        >
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white text-sm font-black">
            {{ step.n }}
          </div>
          <div class="mt-5 text-blue-600 dark:text-blue-400">
            <component :is="step.icon" :size="28" :stroke-width="2.5" />
          </div>
          <h3 class="mt-4 font-black text-slate-800 dark:text-white">{{ step.title }}</h3>
          <p class="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{{ step.desc }}</p>
        </div>
      </div>
    </section>

    <!-- Weekly tasks (dynamic - Doppix / gamification; content pending) -->
    <section class="bg-slate-50 dark:bg-slate-900/40">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <h2 class="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">Еженедельные задания</h2>
        <div
          class="mt-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400"
        >
          Задания появятся после интеграции с Telegram-приложением
        </div>
      </div>
    </section>

    <!-- Strategy 2030 progress + priority directions -->
    <section id="strategy" class="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
      <h2 class="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-400">Общий прогресс Стратегии 2030</h2>
      <div class="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          v-for="stat in progress"
          :key="stat.label"
          class="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 p-6 text-center shadow-sm"
        >
          <p class="text-4xl sm:text-5xl font-black text-indigo-600 dark:text-indigo-400">{{ stat.value }}</p>
          <p class="mt-2 text-xs font-bold text-slate-400 leading-tight">{{ stat.label }}</p>
        </div>
      </div>

      <div class="mt-16 text-center max-w-2xl mx-auto">
        <h3 class="text-3xl sm:text-4xl font-black tracking-tight">5 приоритетных направлений</h3>
        <p class="mt-3 text-slate-500 dark:text-slate-400">Направления развития Стратегии «Узбекистан - 2030»</p>
      </div>
      <div class="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="dir in directions"
          :key="dir.title"
          class="bg-white dark:bg-slate-900 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex gap-4"
        >
          <div
            class="shrink-0 w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400"
          >
            <component :is="dir.icon" :size="22" :stroke-width="2.5" />
          </div>
          <p class="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-snug">{{ dir.title }}</p>
        </div>
      </div>
    </section>

    <!-- Map preview -->
    <section class="bg-slate-50 dark:bg-slate-900/40">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div class="text-center max-w-2xl mx-auto">
          <h2 class="text-3xl sm:text-4xl font-black tracking-tight">Карта Республики Узбекистан</h2>
          <p class="mt-3 text-slate-500 dark:text-slate-400">Объекты инфраструктуры и оценки по районам</p>
        </div>
        <NuxtLink
          to="/map"
          class="mt-10 block rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-indigo-950 p-16 text-center hover:shadow-lg transition-shadow"
        >
          <MapIcon :size="48" class="mx-auto text-blue-600 dark:text-blue-400" />
          <span class="mt-4 inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
            Открыть карту
            <ArrowRight :size="16" />
          </span>
        </NuxtLink>
      </div>
    </section>

    <!-- Votes feed (dynamic) -->
    <section class="mx-auto max-w-7xl px-4 sm:px-6 py-16 sm:py-20">
      <h2 class="text-3xl sm:text-4xl font-black tracking-tight">Лента голосов</h2>
      <p class="mt-3 text-slate-500 dark:text-slate-400">
        Реальные обращения граждан - голосуйте и следите за решением
      </p>
      <div
        class="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400"
      >
        Лента появится после интеграции с Telegram-приложением
      </div>
    </section>

    <!-- Stories (dynamic) -->
    <section class="bg-slate-50 dark:bg-slate-900/40">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-16">
        <div class="flex items-end justify-between gap-4">
          <div>
            <h2 class="text-3xl sm:text-4xl font-black tracking-tight">Истории людей</h2>
            <p class="mt-3 text-slate-500 dark:text-slate-400">
              Реальные истории граждан, чьи обращения привели к переменам
            </p>
          </div>
          <NuxtLink
            to="/stories"
            class="hidden sm:inline-flex items-center gap-2 text-sm font-black uppercase tracking-widest text-blue-600 dark:text-blue-400 shrink-0"
          >
            Все истории
            <ArrowRight :size="16" />
          </NuxtLink>
        </div>
        <div
          class="mt-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center text-sm text-slate-400"
        >
          Истории появятся после подготовки материалов
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import {
  ShieldCheck, FileText, MapPin, Landmark, CheckCircle2,
  Sprout, BarChart3, Scale, Droplet, Map as MapIcon, ArrowRight,
} from 'lucide-vue-next'

useSeoMeta({
  title: 'REAL HOLAT - Стратегия «Узбекистан - 2030»',
  description: 'Гражданский мониторинг инфраструктуры Узбекистана. Сообщайте о проблемах, влияйте на изменения, следите за результатами.',
})

const heroChips = ['Цели', 'Реформы', 'Результаты']

// How-it-works steps - static design copy from the mockup (Страница_3).
const steps = [
  { n: 1, icon: FileText, title: 'Выберите цель', desc: 'Выберите одну из 100 целей Стратегии 2030, которую хотите подтвердить' },
  { n: 2, icon: MapPin, title: 'Подтвердите данные', desc: 'Прикрепите фото, видео, геолокацию или заполните короткую анкету' },
  { n: 3, icon: Landmark, title: 'Проверка и верификация', desc: 'Данные проходят автоматическую проверку и подтверждение несколькими пользователями' },
  { n: 4, icon: CheckCircle2, title: 'Обновление индикатора', desc: 'Ваш вклад отображается на дашборде и влияет на достижение целей' },
]

// Strategy framing figures as presented in the design. The "%" card is a live-data
// placeholder (per-direction completion from the Agency Dashboard, ОВ №12).
const progress = [
  { value: '5', label: 'приоритетных направлений' },
  { value: '100', label: 'конкретных целей' },
  { value: '500+', label: 'индикаторов прогресса' },
  { value: '%', label: 'выполнения по каждому направлению' },
]

// The five priority directions of Strategy Uzbekistan-2030 - static design content.
const directions = [
  { icon: Sprout, title: 'Создание достойных условий для реализации потенциала каждого человека' },
  { icon: BarChart3, title: 'Обеспечение благосостояния населения путём устойчивого экономического роста' },
  { icon: Scale, title: 'Обеспечение верховенства закона, организация государственного управления, ориентированного на служение народу' },
  { icon: Droplet, title: 'Сбережение водных ресурсов и охрана окружающей среды' },
  { icon: ShieldCheck, title: 'Последовательное продолжение политики, основанной на принципе «безопасное и миролюбивое государство»' },
]
</script>
