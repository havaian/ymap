<template>
  <header
    class="sticky top-0 z-[1000] bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-100 dark:border-slate-800 transition-colors duration-100"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
      <NuxtLink to="/" class="flex items-center gap-2 shrink-0">
        <span
          class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white"
        >
          <MapIcon :size="20" />
        </span>
        <span class="font-black text-lg tracking-tight hidden sm:inline">Y.Map</span>
      </NuxtLink>

      <nav class="hidden lg:flex items-center gap-1 ml-2">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          active-class="!text-blue-600 dark:!text-blue-400"
        >
          {{ $t(link.label) }}
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <NuxtLink
        to="/search"
        :aria-label="$t('nav.search')"
        class="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <SearchIcon :size="18" />
      </NuxtLink>

      <ThemeToggle />

      <ClientOnly>
        <div class="flex items-center gap-2">
          <template v-if="isAuthenticated">
            <NuxtLink
              to="/profile"
              class="px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:inline-flex items-center gap-2"
            >
              <UserIcon :size="16" />
              {{ $t('nav.profile') }}
            </NuxtLink>
            <button
              type="button"
              class="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              @click="onLogout"
            >
              {{ $t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="hidden sm:inline-flex px-4 py-2 rounded-xl text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              {{ $t('nav.login') }}
            </NuxtLink>
            <!-- Registration flow is Telegram-based per ТЗ; no web register page yet -> /login. -->
            <NuxtLink
              to="/login"
              class="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              {{ $t('nav.register') }}
            </NuxtLink>
          </template>
        </div>
      </ClientOnly>

      <button
        type="button"
        class="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        :aria-label="mobileOpen ? 'Закрыть меню' : 'Открыть меню'"
        @click="mobileOpen = !mobileOpen"
      >
        <XIcon v-if="mobileOpen" :size="20" />
        <MenuIcon v-else :size="20" />
      </button>
    </div>

    <nav
      v-if="mobileOpen"
      class="lg:hidden border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex flex-col gap-1"
    >
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="px-3 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        active-class="!text-blue-600 dark:!text-blue-400"
        @click="mobileOpen = false"
      >
        {{ $t(link.label) }}
      </NuxtLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import {
  Map as MapIcon,
  Search as SearchIcon,
  User as UserIcon,
  Menu as MenuIcon,
  X as XIcon,
} from 'lucide-vue-next'

const { isAuthenticated, logout } = useAuth()
const router = useRouter()
const mobileOpen = ref(false)

// "Стратегия 2030" anchors the strategy section on the landing (id="strategy").
const links = [
  { to: '/', label: 'nav.home' },
  { to: '/#strategy', label: 'nav.strategy' },
  { to: '/analytics', label: 'nav.analytics' },
  { to: '/stories', label: 'nav.stories' },
  { to: '/about', label: 'nav.about' },
]

const onLogout = () => {
  logout()
  router.push('/')
}
</script>
