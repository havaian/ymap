<template>
  <footer
    class="border-t border-rule bg-paper-raised transition-colors duration-instant dark:border-night-rule dark:bg-night-raised"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
      <div class="col-span-2 md:col-span-1">
        <div class="flex items-center gap-2">
          <BrandMark :size="36" />
          <span class="font-display text-lead font-semibold tracking-tight">Y.Map</span>
        </div>
        <div class="flex items-center gap-2 mt-4">
          <a
            v-for="s in socials"
            :key="s.label"
            :href="s.href"
            :aria-label="s.label"
            :title="s.label"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-paper-sunk text-ink-muted transition-colors hover:bg-rule dark:bg-night-sunk dark:text-ink-faint dark:hover:bg-night-rule"
          >
            <component :is="s.icon" :size="16" />
          </a>
        </div>
      </div>

      <div v-for="col in columns" :key="col.title">
        <h3 class="eyebrow mb-3">{{ col.title }}</h3>
        <ul class="space-y-2 text-body">
          <li v-for="item in col.items" :key="item.label">
            <NuxtLink :to="item.to" class="footer-link">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-rule dark:border-night-rule">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-note text-ink-faint">© {{ year }} Y.Map</div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { Send, MessageCircle, Mail, Globe } from 'lucide-vue-next'

const year = new Date().getFullYear()

// Адреса обратной связи задаются переменными окружения, а не правкой этого файла:
// NUXT_PUBLIC_CONTACT_TELEGRAM, NUXT_PUBLIC_CONTACT_CHAT, NUXT_PUBLIC_CONTACT_EMAIL,
// NUXT_PUBLIC_CONTACT_SITE. Пустое значение иконку не убирает - место в подвале
// остаётся за ней, ссылка ведёт в никуда до тех пор, пока значение не задано.
const { contacts } = useRuntimeConfig().public as {
  contacts: { telegram: string; chat: string; email: string; site: string }
}

// Голый адрес почты в href без схемы открывается как относительный путь, поэтому
// mailto подставляется здесь, а не в переменной окружения.
const href = (value: string | undefined) => {
  const v = (value ?? '').trim()
  if (!v) return '#'
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) return v
  if (v.includes('@')) return `mailto:${v}`
  return v
}

const socials = computed(() => [
  { label: 'Telegram', href: href(contacts?.telegram), icon: Send },
  { label: 'Чат', href: href(contacts?.chat), icon: MessageCircle },
  { label: 'Почта', href: href(contacts?.email), icon: Mail },
  { label: 'Сайт', href: href(contacts?.site), icon: Globe },
])

// Состав колонок повторяет макет. Маршруты, которых ещё нет, стоят заглушкой "#".
const columns = [
  {
    title: 'Проект',
    items: [
      { label: 'Главная', to: '/' },
      { label: 'О проекте', to: '/about' },
      { label: 'Вакансии', to: '#' },
    ],
  },
  {
    title: 'Платформа',
    items: [
      { label: 'Журнал изменений', to: '#' },
      { label: 'Подключения', to: '#' },
      { label: 'Шаблоны', to: '#' },
    ],
  },
  {
    title: 'Материалы',
    items: [
      { label: 'Политика конфиденциальности', to: '#' },
      { label: 'Безопасность', to: '#' },
      { label: 'Связаться', to: '#' },
    ],
  },
]
</script>

<style scoped>
.footer-link {
  @apply text-ink-muted transition-colors hover:text-prussian-600 dark:text-ink-faint dark:hover:text-prussian-200;
}
</style>
