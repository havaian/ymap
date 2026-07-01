<template>
  <div
    class="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased transition-colors duration-100"
  >
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>
