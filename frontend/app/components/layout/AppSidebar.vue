<template>
  <!-- Mobile backdrop -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-[1200] bg-black/40 lg:hidden"
    @click="$emit('update:mobileOpen', false)"
  />

  <aside
    :class="[
      'fixed left-0 top-0 z-[1300] flex h-screen flex-col border-r border-rule bg-paper-raised transition-[width,transform] duration-200 dark:border-night-rule dark:bg-night-raised',
      collapsed ? 'w-20' : 'w-64',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Logo + collapse -->
    <div class="flex h-16 items-center gap-2 border-b border-rule px-4 dark:border-night-rule">
      <NuxtLink to="/" class="flex items-center gap-2 overflow-hidden">
        <span
          class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-prussian-600 text-paper"
        >
          <MapIcon :size="20" />
        </span>
        <span v-if="!collapsed" class="whitespace-nowrap font-display text-lead font-semibold tracking-tight">Y.Map</span>
      </NuxtLink>
      <button
        type="button"
        class="ml-auto hidden h-8 w-8 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-paper-sunk dark:hover:bg-night-sunk lg:inline-flex"
        :aria-label="collapsed ? 'Развернуть меню' : 'Свернуть меню'"
        @click="$emit('update:collapsed', !collapsed)"
      >
        <ChevronsLeft :size="18" :class="collapsed ? 'rotate-180' : ''" />
      </button>
      <button
        type="button"
        class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-faint transition-colors hover:bg-paper-sunk dark:hover:bg-night-sunk lg:hidden"
        aria-label="Закрыть меню"
        @click="$emit('update:mobileOpen', false)"
      >
        <XIcon :size="18" />
      </button>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6">
      <div v-for="group in groups" :key="group.key">
        <div v-if="!collapsed" class="px-3 mb-2">
          <p class="eyebrow">
            {{ $t(group.label) }}
          </p>
          <!-- The two main groups run on different data. Saying which is which here
               is cheaper than letting someone open an empty civic page next to a
               full registry one and conclude the product is half broken. -->
          <p v-if="group.hint" class="mt-0.5 text-label leading-tight text-ink-faint">
            {{ group.hint }}
          </p>
        </div>
        <div class="space-y-1">
          <template v-for="item in group.items" :key="item.to">
            <!-- Regular link -->
            <NuxtLink
              :to="item.to"
              class="sidebar-item"
              :class="collapsed ? 'justify-center' : ''"
              active-class="sidebar-item-active"
              :title="collapsed ? $t(item.label) : undefined"
              @click="$emit('update:mobileOpen', false)"
            >
              <component :is="item.icon" :size="18" class="shrink-0" />
              <span v-if="!collapsed">{{ $t(item.label) }}</span>
            </NuxtLink>
          </template>
        </div>
      </div>
    </nav>

    <!-- Bottom -->
    <div class="space-y-1 border-t border-rule p-3 dark:border-night-rule">
      <NuxtLink
        to="/about"
        class="sidebar-item"
        :class="collapsed ? 'justify-center' : ''"
        :title="collapsed ? $t('nav.help') : undefined"
        @click="$emit('update:mobileOpen', false)"
      >
        <HelpCircle :size="18" class="shrink-0" />
        <span v-if="!collapsed">{{ $t('nav.help') }}</span>
      </NuxtLink>
      <button
        type="button"
        class="w-full sidebar-item text-red-500 hover:!bg-red-50 dark:hover:!bg-red-900/20"
        :class="collapsed ? 'justify-center' : ''"
        :title="collapsed ? $t('nav.logout') : undefined"
        @click="onLogout"
      >
        <LogOut :size="18" class="shrink-0" />
        <span v-if="!collapsed">{{ $t('nav.logout') }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import {
  Map as MapIcon,
  BarChart3,
  MapPin,
  Newspaper,
  BookOpen,
  Users,
  User as UserIcon,
  Trophy,
  HelpCircle,
  LogOut,
  ChevronsLeft,
  X as XIcon,
  Gauge,
  Building2,
  ClipboardCheck,
  Database,
  LayoutDashboard,
} from 'lucide-vue-next'

defineProps<{ collapsed: boolean; mobileOpen: boolean }>()
defineEmits<{ 'update:collapsed': [boolean]; 'update:mobileOpen': [boolean] }>()

interface NavItem {
  to: string
  label: string
  icon: Component
}
interface NavGroup {
  key: string
  label: string
  // Plain text, not a translation key: one line naming what feeds this group.
  hint?: string
  items: NavItem[]
}

const { logout } = useAuth()
const router = useRouter()

// Sidebar per Страница_4 / Страница_5. Аналитика sub-items point to /analytics until the
// tabs land in Этап 3. Помощь points to /about for now (no dedicated help page yet).
//
// REWORKED. The single expandable "Аналитика" node is gone. It held four pages when
// there were four; there are now nine, and more importantly they are not one thing.
// Five run on the facility registers and four on what people submit through the
// platform. Those two are at completely different stages of fill, and a flat list
// put an empty page next to a full one with nothing to distinguish them.
//
// So the split is structural, not cosmetic: two groups, each labelled with what
// feeds it. The map belongs to the registry side, the feed to the civic side.
const groups: NavGroup[] = [
  {
    key: 'observatory',
    label: 'groups.observatory',
    hint: 'Реестры объектов и модели на них',
    items: [
      { to: '/map', label: 'nav.map', icon: MapPin },
      { to: '/analytics/capacity', label: 'nav.capacity', icon: Gauge },
      { to: '/analytics/wear', label: 'nav.wear', icon: Building2 },
      { to: '/analytics/deprivation', label: 'nav.deprivation', icon: BarChart3 },
      { to: '/analytics/verification', label: 'nav.verification', icon: ClipboardCheck },
      { to: '/analytics/data-quality', label: 'nav.dataQuality', icon: Database },
    ],
  },
  {
    key: 'civic',
    label: 'groups.civic',
    hint: 'Обращения и проверки от пользователей',
    items: [
      // COLLAPSED. Regions, Current and Problems are still routed and their files
      // are untouched; they are out of the menu because all three run on the civic
      // circuit and it holds no data yet. Three empty pages beside five full ones
      // do not read as "not filled in", they read as "half broken", and the cost
      // of restoring them when submissions start is these three lines.
      { to: '/feed', label: 'nav.feed', icon: Newspaper },
      { to: '/analytics', label: 'nav.civicOverview', icon: LayoutDashboard },
    ],
  },
  {
    key: 'media',
    label: 'groups.media',
    items: [
      { to: '/knowledge', label: 'nav.knowledge', icon: BookOpen },
      { to: '/stories', label: 'nav.stories', icon: Users },
    ],
  },
  {
    key: 'profile',
    label: 'groups.profile',
    items: [
      { to: '/profile', label: 'nav.profile', icon: UserIcon },
      { to: '/leaderboard', label: 'nav.leaderboard', icon: Trophy },
    ],
  },
]

const onLogout = () => {
  logout()
  router.push('/')
}
</script>

<style scoped>
.sidebar-item {
  @apply flex items-center gap-3 rounded-control px-3 py-2 text-body font-medium text-ink-muted transition-colors hover:bg-paper-sunk dark:text-ink-faint dark:hover:bg-night-sunk;
}
.sidebar-item-active {
  @apply bg-prussian-50 font-semibold text-prussian-600 dark:bg-prussian-900/40 dark:text-prussian-200;
}
</style>
