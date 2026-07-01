<template>
  <header
    class="sticky top-0 z-[1000] h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800 transition-colors duration-100"
  >
    <div class="h-full px-4 sm:px-6 flex items-center gap-3">
      <button
        type="button"
        class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Меню"
        @click="$emit('toggleMobile')"
      >
        <MenuIcon :size="20" />
      </button>

      <div class="min-w-0">
        <h1 class="text-xl font-black tracking-tight truncate">{{ title }}</h1>
        <p v-if="subtitle" class="text-xs text-slate-500 dark:text-slate-400 truncate">
          {{ subtitle }}
        </p>
      </div>

      <div class="flex-1" />

      <NuxtLink
        to="/map"
        class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
      >
        <ShieldCheck :size="16" />
        {{ $t('actions.checkObject') }}
      </NuxtLink>

      <NuxtLink
        to="/search"
        :aria-label="$t('nav.search')"
        class="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <SearchIcon :size="18" />
      </NuxtLink>

      <ThemeToggle />
    </div>
  </header>
</template>

<script setup lang="ts">
import { Menu as MenuIcon, Search as SearchIcon, ShieldCheck } from 'lucide-vue-next'

defineEmits<{ toggleMobile: [] }>()

// Page title/subtitle come from route meta (set via definePageMeta on each app page).
const route = useRoute()
const meta = computed(() => route.meta as { pageTitle?: string; pageSubtitle?: string })
const title = computed(() => meta.value.pageTitle ?? '')
const subtitle = computed(() => meta.value.pageSubtitle ?? '')
</script>
