<template>
  <PagePlaceholder title="Лента обращений" phase="Этап 6" />
</template>

<script setup lang="ts">
// Feed comes from the Doppix Telegram-app (Этап 6). Uses the app shell (sidebar).
definePageMeta({
  layout: 'app',
  pageTitle: 'Лента обращений',
  pageSubtitle: 'Сообщения граждан',
})
useSeoMeta({ title: 'Лента обращений - Y.Map' })
</script>
