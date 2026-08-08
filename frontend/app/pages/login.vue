<template>
  <div class="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
    <div
      class="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden"
    >
      <div class="p-8 text-center bg-gradient-to-br from-blue-600 to-indigo-700 text-white relative">
        <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        <div
          class="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl mb-4 shadow-xl"
        >
          <MapIcon :size="32" />
        </div>
        <h2 class="text-3xl font-black tracking-tight mb-2">Y.Map</h2>
        <p class="text-blue-100 text-xs font-bold uppercase tracking-widest">
          Цифровая инфраструктура
        </p>
      </div>

      <div class="p-8">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <div>
            <label
              class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1"
            >
              Email пользователя
            </label>
            <div class="relative">
              <UserIcon class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="email"
                type="email"
                placeholder="name@example.com"
                required
                class="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition"
              />
            </div>
          </div>

          <div>
            <label
              class="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1"
            >
              Пароль
            </label>
            <div class="relative">
              <ShieldCheck class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                v-model="password"
                type="password"
                placeholder="••••••••"
                required
                class="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white transition"
              />
            </div>
          </div>

          <div
            v-if="error"
            class="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-xs font-bold text-center"
          >
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="isLoading"
            class="w-full bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 active:bg-slate-950 dark:active:bg-blue-800 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/10 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
            <template v-else>
              <LogIn :size="18" />
              Войти в систему
            </template>
          </button>
        </form>

        <div
          class="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700"
        >
          <div class="flex gap-3">
            <Info class="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div class="space-y-1">
              <p class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase">
                Тестовые аккаунты:
              </p>
              <p class="text-[10px] text-slate-400">admin@ymap.ytech.space</p>
              <p class="text-[10px] text-slate-400">org_*@ymap.ytech.space</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Map as MapIcon, ShieldCheck, User as UserIcon, LogIn, Loader2, Info } from 'lucide-vue-next'

// Ported from frontend/src/components/auth/LoginView.tsx. The old active:scale-[0.98]
// on the submit button is replaced with a background change (project rule: no scale).
const { isAuthenticated, login } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const isLoading = ref(false)

// Already signed in -> go to profile (ТЗ 6.8). Route is client-only, so onMounted fires.
onMounted(() => {
  if (isAuthenticated.value) navigateTo('/profile')
})

const handleSubmit = async () => {
  isLoading.value = true
  error.value = ''
  try {
    await login(email.value, password.value)
    await navigateTo('/profile')
  } catch (err: any) {
    error.value = err?.data?.message || 'Неверный email или пароль'
  } finally {
    isLoading.value = false
  }
}
</script>
