<template>
  <header
    class="sticky top-0 z-[1000] h-16 border-b border-rule bg-paper-raised/90 backdrop-blur transition-colors duration-instant dark:border-night-rule dark:bg-night-raised/90"
  >
    <div class="h-full px-4 sm:px-6 flex items-center gap-3">
      <button
        type="button"
        class="inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk lg:hidden"
        aria-label="Меню"
        @click="$emit('toggleMobile')"
      >
        <MenuIcon :size="20" />
      </button>

      <div class="min-w-0">
        <h1 class="truncate font-display text-h3 font-semibold text-ink dark:text-paper">{{ title }}</h1>
        <p v-if="subtitle" class="truncate text-note text-ink-muted dark:text-ink-faint">
          {{ subtitle }}
        </p>
      </div>

      <div class="flex-1" />

      <NuxtLink
        to="/map"
        class="hidden items-center gap-2 rounded-control bg-prussian-600 px-4 py-2 text-body font-semibold text-paper transition-colors hover:bg-prussian-700 sm:inline-flex"
      >
        <ShieldCheck :size="16" />
        {{ $t('actions.checkObject') }}
      </NuxtLink>

      <NuxtLink
        to="/search"
        :aria-label="$t('nav.search')"
        class="inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk"
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
