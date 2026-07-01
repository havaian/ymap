<template>
  <footer
    class="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors duration-100"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
      <div class="col-span-2 md:col-span-1">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white"
          >
            <MapIcon :size="20" />
          </span>
          <span class="font-black text-lg tracking-tight">REAL HOLAT</span>
        </div>
        <div class="flex items-center gap-2 mt-4">
          <a
            v-for="s in socials"
            :key="s.label"
            :href="s.href"
            :aria-label="s.label"
            class="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <component :is="s.icon" :size="16" />
          </a>
        </div>
      </div>

      <div v-for="col in columns" :key="col.title">
        <h3 class="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{{ col.title }}</h3>
        <ul class="space-y-2 text-sm">
          <li v-for="item in col.items" :key="item.label">
            <NuxtLink :to="item.to" class="footer-link">{{ item.label }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <div class="border-t border-slate-100 dark:border-slate-800">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-slate-400">© {{ year }} REAL HOLAT</div>
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
  @apply text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors;
}
</style>
