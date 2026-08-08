<template>
  <div
    class="min-h-screen flex flex-col bg-paper text-ink transition-colors duration-instant dark:bg-night dark:text-paper"
  >
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>
