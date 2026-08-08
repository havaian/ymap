<template>
  <footer
    class="border-t border-rule bg-paper-raised transition-colors duration-instant dark:border-night-rule dark:bg-night-raised"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
      <div class="col-span-2 md:col-span-1">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex h-9 w-9 items-center justify-center rounded-control bg-prussian-600 text-paper"
          >
            <MapIcon :size="20" />
          </span>
          <span class="font-display text-lead font-semibold tracking-tight">Y.Map</span>
        </div>
        <div class="flex items-center gap-2 mt-4">
          <a
            v-for="s in socials"
            :key="s.label"
            :href="s.href"
            :aria-label="s.label"
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
import { Map as MapIcon, Send, MessageCircle, Mail, Globe } from 'lucide-vue-next'

const year = new Date().getFullYear()

const socials = [
  { label: 'Telegram', href: '#', icon: Send },
  { label: 'Чат', href: '#', icon: MessageCircle },
  { label: 'Email', href: '#', icon: Mail },
  { label: 'Сайт', href: '#', icon: Globe },
]

// Columns mirror the mockup. Routes that do not exist yet use "#" placeholders.
const columns = [
  {
    title: 'Company',
    items: [
      { label: 'Home', to: '/' },
      { label: 'About Us', to: '/about' },
      { label: 'Careers', to: '#' },
    ],
  },
  {
    title: 'Product',
    items: [
      { label: 'Changelog', to: '#' },
      { label: 'Integrations', to: '#' },
      { label: 'Templates', to: '#' },
    ],
  },
  {
    title: 'Resources',
    items: [
      { label: 'Privacy Policy', to: '#' },
      { label: 'Security', to: '#' },
      { label: 'Contact Us', to: '#' },
    ],
  },
]
</script>

<style scoped>
.footer-link {
  @apply text-ink-muted transition-colors hover:text-prussian-600 dark:text-ink-faint dark:hover:text-prussian-200;
}
</style>
