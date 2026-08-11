<template>
  <!-- Лендинг без шапки. Верхняя панель убрана по требованию: первый экран -
       плита с картой, и меню поверх неё спорит с ней за внимание. Подвал и
       тосты остаются, остальная часть сайта продолжает жить на layout default,
       который шапку сохраняет. -->
  <div
    class="min-h-screen flex flex-col bg-paper text-ink transition-colors duration-instant dark:bg-night dark:text-paper"
  >
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <AppToast />
  </div>
</template>
