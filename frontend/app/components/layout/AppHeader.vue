<template>
  <header
    class="sticky top-0 z-[1000] border-b border-rule bg-paper-raised transition-colors duration-instant dark:border-night-rule dark:bg-night-raised"
  >
    <div class="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
      <NuxtLink to="/" class="flex items-center gap-2 shrink-0">
        <BrandMark :size="36" />
        <span class="hidden font-display text-lead font-semibold tracking-tight sm:inline">Y.Map</span>
      </NuxtLink>

      <!-- УДАЛЕНО: пункты «Главная», «Стратегия 2030», «Аналитика», «О нас».
           Сама шапка на месте: знак, поиск, тема, вход. Массив links и разметка
           списка убраны целиком, вернуть пункт - две строки. Отдельно: пункт
           «Стратегия 2030» вёл на якорь /#strategy, а секции с таким id на
           лендинге нет - ссылка была мёртвой. -->

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
    </div>
  </header>
</template>

<script setup lang="ts">
import {
  Search as SearchIcon,
  User as UserIcon,
} from 'lucide-vue-next'

const { isAuthenticated, logout } = useAuth()
const router = useRouter()

const onLogout = () => {
  logout()
  router.push('/')
}
</script>
