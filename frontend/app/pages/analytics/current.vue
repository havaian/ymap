<template>
  <div class="mx-auto max-w-6xl px-4 py-6 sm:px-6">
    <AnalyticsTabs />

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section class="panel p-5 sm:p-6">
        <SectionHead title="Топ 5, лучшие" eyebrow="По результатам проверок" />
        <NoteBlock class="mt-6" tone="caution" title="Скоринг объектов не введён">
          Ни один эндпоинт не возвращает оценку по отдельному объекту. Подставлять
          сюда районные значения нельзя: они считаются на другом знаменателе.
        </NoteBlock>
      </section>

      <section class="panel p-5 sm:p-6">
        <SectionHead title="Требующие внимания" eyebrow="Ниже среднего" />
        <NoteBlock class="mt-6" tone="caution" title="Скоринг объектов не введён">
          Появится вместе с оценкой объекта. До тех пор список объектов, требующих
          проверки, ведёт очередь верификации.
        </NoteBlock>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
// Per-object verification scoring is an open question (ОВ №5); no endpoint returns a
// per-object score yet. The design (objects ranked by %) is kept as structure with an
// empty state rather than substituting region data.
definePageMeta({
  layout: 'app',
  // Этап 10: аналитика публичная (ТЗ раздел 3.4) - гейт логина снят.
  pageTitle: 'Текущая ситуация',
  pageSubtitle: 'Лучшие и проблемные объекты',
})
useSeoMeta({ title: 'Аналитика · Текущая ситуация - Y.Map' })
</script>
