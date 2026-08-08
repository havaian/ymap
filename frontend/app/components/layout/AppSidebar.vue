<template>
  <!-- Mobile backdrop -->
  <div
    v-if="mobileOpen"
    class="fixed inset-0 z-[1200] bg-black/40 lg:hidden"
    @click="$emit('update:mobileOpen', false)"
  />

  <aside
    :class="[
      'fixed top-0 left-0 z-[1300] h-screen bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 flex flex-col transition-[width,transform] duration-200',
      collapsed ? 'w-20' : 'w-64',
      mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Logo + collapse -->
    <div class="h-16 flex items-center gap-2 px-4 border-b border-slate-100 dark:border-slate-800">
      <NuxtLink to="/" class="flex items-center gap-2 overflow-hidden">
        <span
          class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shrink-0"
        >
          <MapIcon :size="20" />
        </span>
        <span v-if="!collapsed" class="font-black tracking-tight whitespace-nowrap">Y.Map</span>
      </NuxtLink>
      <button
        type="button"
        class="ml-auto hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        :aria-label="collapsed ? 'Развернуть меню' : 'Свернуть меню'"
        @click="$emit('update:collapsed', !collapsed)"
      >
        <ChevronsLeft :size="18" :class="collapsed ? 'rotate-180' : ''" />
      </button>
      <button
        type="button"
        class="ml-auto lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        aria-label="Закрыть меню"
        @click="$emit('update:mobileOpen', false)"
      >
        <XIcon :size="18" />
      </button>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-6">
      <div v-for="group in groups" :key="group.key">
        <p
          v-if="!collapsed"
          class="px-3 mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400"
        >
          {{ $t(group.label) }}
        </p>
        <div class="space-y-1">
          <template v-for="item in group.items" :key="item.to ?? item.key">
            <!-- Expandable parent (Аналитика) -->
            <div v-if="item.children">
              <button
                type="button"
                class="w-full sidebar-item"
                :class="collapsed ? 'justify-center' : ''"
                @click="analyticsOpen = !analyticsOpen"
              >
                <component :is="item.icon" :size="18" class="shrink-0" />
                <span v-if="!collapsed" class="flex-1 text-left">{{ $t(item.label) }}</span>
                <ChevronDown
                  v-if="!collapsed"
                  :size="14"
                  class="transition-transform"
                  :class="analyticsOpen ? 'rotate-180' : ''"
                />
              </button>
              <div v-if="analyticsOpen && !collapsed" class="mt-1 ml-9 space-y-1">
                <NuxtLink
                  v-for="child in item.children"
                  :key="child.label"
                  :to="child.to"
                  class="sidebar-subitem"
                  @click="$emit('update:mobileOpen', false)"
                >
                  {{ $t(child.label) }}
                </NuxtLink>
              </div>
            </div>

            <!-- Regular link -->
            <NuxtLink
              v-else
              :to="item.to!"
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
    <div class="border-t border-slate-100 dark:border-slate-800 p-3 space-y-1">
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
  ChevronDown,
  ChevronsLeft,
  X as XIcon,
} from 'lucide-vue-next'

defineProps<{ collapsed: boolean; mobileOpen: boolean }>()
defineEmits<{ 'update:collapsed': [boolean]; 'update:mobileOpen': [boolean] }>()

interface NavChild {
  to: string
  label: string
}
interface NavItem {
  key?: string
  to?: string
  label: string
  icon: Component
  children?: NavChild[]
}
interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const { logout } = useAuth()
const router = useRouter()
const analyticsOpen = ref(true)

// Sidebar per Страница_4 / Страница_5. Аналитика sub-items point to /analytics until the
// tabs land in Этап 3. Помощь points to /about for now (no dedicated help page yet).
const groups: NavGroup[] = [
  {
    key: 'main',
    label: 'groups.main',
    items: [
      {
        key: 'analytics',
        label: 'nav.analytics',
        icon: BarChart3,
        children: [
          { to: '/analytics', label: 'nav.analyticsGeneral' },
          { to: '/analytics/regions', label: 'nav.analyticsRegions' },
          { to: '/analytics/current', label: 'nav.analyticsCurrent' },
          { to: '/analytics/problems', label: 'nav.analyticsProblems' },
        ],
      },
      { to: '/map', label: 'nav.map', icon: MapPin },
      { to: '/feed', label: 'nav.feed', icon: Newspaper },
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
  @apply flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors;
}
.sidebar-item-active {
  @apply bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400;
}
.sidebar-subitem {
  @apply block px-3 py-1.5 rounded-lg text-[13px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors;
}
</style>
