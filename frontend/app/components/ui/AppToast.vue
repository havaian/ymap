<template>
  <div
    class="fixed top-20 right-6 z-[2000] flex flex-col gap-3 pointer-events-none"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="pointer-events-auto flex items-center gap-3 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 min-w-[300px] toast-enter transition-colors duration-100"
    >
      <CheckCircle2 v-if="toast.type === 'success'" class="w-5 h-5 text-green-500" />
      <XCircle v-else class="w-5 h-5 text-red-500" />
      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">
        {{ toast.message }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { CheckCircle2, XCircle } from 'lucide-vue-next'

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
