<template>
  <div
    class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased transition-colors duration-100"
  >
    <AppSidebar v-model:collapsed="collapsed" v-model:mobile-open="mobileOpen" />

    <!-- Content is padded by the sidebar width on lg+ (sidebar is fixed). -->
    <div
      :class="[
        'flex flex-col min-h-screen transition-[padding] duration-200',
        collapsed ? 'lg:pl-20' : 'lg:pl-64',
      ]"
    >
      <AppTopbar @toggle-mobile="mobileOpen = true" />
      <main class="flex-1">
        <slot />
      </main>
    </div>

    <AppToast />
  </div>
</template>

<script setup lang="ts">
const collapsed = ref(false)
const mobileOpen = ref(false)
</script>
