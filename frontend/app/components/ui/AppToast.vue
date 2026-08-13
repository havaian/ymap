<template>
  <!-- На телефоне уведомление прижималось к правому краю и имело твёрдую
       минимальную ширину 300 px: длинное сообщение выходило за экран, а короткое
       всё равно занимало почти всю ширину. До sm полоса тянется от края до края
       с полями страницы, минимальная ширина снята. -->
  <div class="pointer-events-none fixed inset-x-4 top-20 z-[2000] flex flex-col gap-3 sm:inset-x-auto sm:right-6">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="panel toast-enter pointer-events-auto flex items-start gap-3 px-4 py-3 transition-colors duration-instant sm:min-w-[300px] sm:items-center"
    >
      <CheckCircle2 v-if="toast.type === 'success'" class="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" :style="{ color: SCALE_COLORS.ok }" />
      <XCircle v-else class="mt-0.5 h-5 w-5 shrink-0 sm:mt-0" :style="{ color: SCALE_COLORS.bad }" />
      <p class="min-w-0 text-body font-medium text-ink dark:text-paper">
        {{ toast.message }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { CheckCircle2, XCircle } from 'lucide-vue-next'

// Success and failure read off the same ramp as every chart and the choropleth,
// so a green here is the same green as a sufficient district. The old pair was
// text-green-500 / text-red-500 straight from the stock palette.
const { SCALE_COLORS } = useScale()

const ui = useUiStore()
const { toasts } = storeToRefs(ui)
</script>

<style scoped>
/* Slide-in without transform: scale (project rule). */
@keyframes toast-enter {
  from {
    opacity: 0;
    transform: translateX(1rem);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.toast-enter {
  animation: toast-enter 0.15s ease-out;
}
</style>
