<template>
  <div
    class="relative flex min-h-screen flex-col overflow-hidden bg-prussian-800 text-prussian-50"
    :style="gridStyle"
  >
    <!-- Знак и имя проекта вместо шапки: страница ошибки не должна тянуть за
         собой навигацию, из которой сюда всё равно не приходят. -->
    <div class="relative mx-auto flex w-full max-w-7xl items-center gap-2 px-4 py-6 sm:px-6">
      <NuxtLink to="/" class="flex items-center gap-2">
        <BrandMark :size="36" />
        <span class="font-display text-lead font-semibold tracking-tight">Y.Map</span>
      </NuxtLink>
    </div>

    <div class="relative mx-auto flex w-full max-w-7xl flex-1 items-center px-4 pb-16 sm:px-6">
      <div class="grid w-full grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,32rem)_1fr]">
        <div>
          <p class="eyebrow text-prussian-200">Ошибка {{ code }}</p>
          <h1 class="mt-4 font-display text-[2.5rem] font-semibold leading-[1.05] tracking-tight sm:text-[3.5rem]">
            {{ heading }}
          </h1>
          <p class="mt-6 max-w-lg text-lead text-prussian-100/75">
            {{ lead }}
          </p>

          <!-- Адрес, по которому пришли. Он же первое, что спросят при разборе. -->
          <p v-if="path" class="mt-6 max-w-lg overflow-hidden text-ellipsis rounded-control border border-prussian-200/20 bg-prussian-900/40 px-3 py-2 font-mono text-note text-prussian-100/70">
            {{ path }}
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-control bg-prussian-50 px-5 py-3 text-body font-semibold text-prussian-800 transition-colors hover:bg-white"
              @click="goHome"
            >
              <Home :size="16" />
              На главную
            </button>
            <NuxtLink
              to="/map"
              class="inline-flex items-center gap-2 rounded-control border border-prussian-200/30 px-5 py-3 text-body font-medium text-prussian-50 transition-colors hover:bg-prussian-200/10"
            >
              <MapPin :size="16" />
              Открыть карту
            </NuxtLink>
            <NuxtLink
              to="/analytics/data-quality"
              class="inline-flex items-center gap-2 rounded-control px-2 py-3 text-body font-medium text-prussian-100/70 transition-colors hover:text-prussian-50"
            >
              Отчёт о качестве данных
              <ArrowUpRight :size="16" />
            </NuxtLink>
          </div>
        </div>

        <!-- Сетка ячеек с одной выпавшей. Тот же язык, что у знака проекта:
             реестр - это набор ячеек, и здесь одной из них нет. Рисуется, а не
             импортируется картинкой: один файл, никакого ассета. -->
        <div class="hidden lg:block">
          <div class="grid max-w-md grid-cols-6 gap-2.5">
            <span
              v-for="i in 24"
              :key="i"
              class="aspect-square rounded-[4px] transition-colors"
              :class="i === MISSING
                ? 'border border-dashed border-prussian-200/60 bg-transparent'
                : 'bg-prussian-200/15'"
            />
          </div>
          <p class="mt-4 flex items-center gap-2 text-label text-prussian-200/60">
            <span class="inline-block h-3 w-3 rounded-[3px] border border-dashed border-prussian-200/60" />
            записи по этому адресу нет
          </p>
        </div>
      </div>
    </div>

    <div class="relative border-t border-prussian-200/15">
      <div class="mx-auto max-w-7xl px-4 py-5 text-note text-prussian-100/50 sm:px-6">
        Y.Map - независимая обсерватория данных о социальной инфраструктуре Узбекистана.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Страница ошибки. Одна на 404 и на всё остальное: код и текст меняются, вид -
 * нет.
 *
 * Собственная раскладка, а не layout: сюда попадают в том числе с адресов, для
 * которых страницы нет вообще, и тащить за собой шапку с меню разделов незачем.
 *
 * Сетка чертёжной бумаги нарисована фоном самой секции, как на первом экране
 * лендинга, а не отдельным позиционированным слоем: лишний слой пришлось бы
 * перерисовывать вместе со всем, что над ним.
 */
import { Home, MapPin, ArrowUpRight } from 'lucide-vue-next'
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const route = useRoute()

const code = computed(() => props.error?.statusCode ?? 500)
const path = computed(() => props.error?.url || route.fullPath || '')

const heading = computed(() =>
  code.value === 404 ? 'Такого адреса на платформе нет' : 'Запрос не выполнен',
)

const lead = computed(() =>
  code.value === 404
    ? 'Адрес не совпадает ни с одним разделом. Ссылка могла устареть после переустройства навигации, а ссылка из письма - после истечения срока действия.'
    : 'Сервер не смог обработать запрос. Данные при этом не менялись: повторите попытку или вернитесь к карте.',
)

// Индекс выпавшей ячейки. Фиксированный: сетка, которая переставляет дырку на
// каждый рендер, читается как помеха, а не как знак.
const MISSING = 15

// Та же чертёжная сетка, что на первом экране лендинга.
const gridStyle = {
  backgroundImage:
    'linear-gradient(to right, rgba(143,197,232,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(143,197,232,0.045) 1px, transparent 1px)',
  backgroundSize: '48px 48px',
}

// clearError снимает состояние ошибки и уводит на главную; простой переход по
// ссылке оставил бы ошибку в состоянии приложения.
const goHome = () => clearError({ redirect: '/' })

useHead({
  title: computed(() =>
    code.value === 404 ? 'Страница не найдена - Y.Map' : `Ошибка ${code.value} - Y.Map`,
  ),
})
</script>
