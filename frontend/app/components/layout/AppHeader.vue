<template>
  <header
    class="sticky top-0 z-[1000] border-b border-rule bg-paper-raised transition-colors duration-instant dark:border-night-rule dark:bg-night-raised"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
      <NuxtLink to="/" class="flex items-center gap-2 shrink-0">
        <BrandMark :size="36" />
        <span class="hidden font-display text-lead font-semibold tracking-tight sm:inline">Y.Map</span>
      </NuxtLink>

      <nav class="hidden lg:flex items-center gap-1 ml-2">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="rounded-control px-3 py-2 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk"
          active-class="!text-prussian-600 dark:!text-prussian-200"
        >
          {{ $t(link.label) }}
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <NuxtLink
        to="/search"
        :aria-label="$t('nav.search')"
        class="inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk"
      >
        <SearchIcon :size="18" />
      </NuxtLink>

      <ThemeToggle />

      <ClientOnly>
        <div class="flex items-center gap-2">
          <template v-if="isAuthenticated">
            <NuxtLink
              to="/profile"
              class="px-3 py-2 rounded-control text-body font-medium text-ink dark:text-paper hover:bg-paper-sunk dark:hover:bg-night-sunk transition-colors hidden sm:inline-flex items-center gap-2"
            >
              <UserIcon :size="16" />
              {{ $t('nav.profile') }}
            </NuxtLink>
            <button
              type="button"
              class="rounded-control px-3 py-2 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk"
              @click="onLogout"
            >
              {{ $t('nav.logout') }}
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="hidden sm:inline-flex px-4 py-2 rounded-control text-body font-semibold text-prussian-600 dark:text-prussian-200 border border-rule dark:border-night-rule hover:bg-paper-sunk dark:hover:bg-night-sunk transition-colors"
            >
              {{ $t('nav.login') }}
            </NuxtLink>
            <!-- Registration flow is Telegram-based per ТЗ; no web register page yet -> /login. -->
            <!-- Отменено: веб-регистрация с подтверждением почты живёт на /register. -->
            <NuxtLink
              to="/register"
              class="px-4 py-2 rounded-control text-body font-semibold text-paper bg-prussian-600 hover:bg-prussian-700 transition-colors"
            >
              {{ $t('nav.register') }}
            </NuxtLink>
          </template>
        </div>
      </ClientOnly>

      <button
        type="button"
        class="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk"
        :aria-label="mobileOpen ? 'Закрыть меню' : 'Открыть меню'"
        @click="mobileOpen = !mobileOpen"
      >
        <XIcon v-if="mobileOpen" :size="20" />
        <MenuIcon v-else :size="20" />
      </button>
    </div>

    <nav
      v-if="mobileOpen"
      class="lg:hidden border-t border-rule dark:border-night-rule px-4 py-2 flex flex-col gap-1"
    >
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="rounded-control px-3 py-2 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk"
        active-class="!text-prussian-600 dark:!text-prussian-200"
        @click="mobileOpen = false"
      >
        {{ $t(link.label) }}
      </NuxtLink>
    </nav>
  </header>
</template>

<script setup lang="ts">
import {
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
  { to: '/about', label: 'nav.about' },
]

const onLogout = () => {
  logout()
  router.push('/')
}
</script>
