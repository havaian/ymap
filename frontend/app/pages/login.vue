<template>
  <div class="mx-auto flex min-h-[calc(100vh-4rem)] min-h-[calc(100dvh-4rem)] max-w-md items-center px-4 py-10 sm:px-6">
    <div class="w-full">
      <div class="flex items-center gap-3">
        <BrandMark :size="40" />
        <div>
          <p class="eyebrow">Обсерватория данных</p>
          <p class="font-display text-h3 font-semibold tracking-tight text-ink dark:text-paper">Y.Map</p>
        </div>
      </div>

      <h1 class="mt-8 font-display text-h1 font-semibold tracking-tight text-ink dark:text-paper">
        Вход
      </h1>
      <p class="mt-2 text-body text-ink-muted dark:text-ink-faint">
        Аналитика и карта открыты без входа. Аккаунт нужен для верификации записей реестра.
      </p>

      <form class="mt-8 space-y-5" @submit.prevent="handleSubmit">
        <div>
          <label for="login-email" class="eyebrow block">Адрес почты</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="name@example.com"
            required
            class="control mt-2 w-full"
          />
        </div>

        <div>
          <div class="flex items-baseline justify-between gap-3">
            <label for="login-password" class="eyebrow">Пароль</label>
            <NuxtLink
              to="/forgot-password"
              class="text-label text-prussian-600 dark:text-prussian-200"
            >
              Забыли пароль?
            </NuxtLink>
          </div>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="••••••••"
            required
            class="control mt-2 w-full"
          />
        </div>

        <NoteBlock v-if="error" tone="caution">
          {{ error }}
          <!-- An unconfirmed address is the one failure the user can fix from here,
               so the resend sits inside the message instead of in a separate state. -->
          <button
            v-if="needsVerification"
            type="button"
            class="mt-2 block text-body font-semibold text-prussian-600 underline underline-offset-2 dark:text-prussian-200"
            :disabled="resending"
            @click="resend"
          >
            {{ resending ? 'Письмо отправляется…' : 'Отправить письмо подтверждения заново' }}
          </button>
        </NoteBlock>

        <NoteBlock v-if="resent">
          Письмо отправлено на {{ email }}. Проверьте почту, включая папку со спамом.
        </NoteBlock>

        <button
          type="submit"
          :disabled="isLoading"
          class="w-full rounded-control bg-prussian-600 px-5 py-3 text-body font-semibold text-paper transition-colors hover:bg-prussian-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {{ isLoading ? 'Данные проверяются…' : 'Войти' }}
        </button>
      </form>

      <p class="mt-6 border-t border-rule pt-5 text-body text-ink-muted dark:border-night-rule dark:text-ink-faint">
        Нет аккаунта?
        <NuxtLink to="/register" class="font-semibold text-prussian-600 dark:text-prussian-200">
          Зарегистрироваться
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// Ported from frontend/src/components/auth/LoginView.tsx. The old active:scale-[0.98]
// on the submit button is replaced with a background change (project rule: no scale).
//
// REWORKED to the register design system. What was here was a floating card with a
// blue-to-indigo gradient header, rounded-[2.5rem] corners, shadow-2xl and a block
// of demo credentials printed on a public page. None of that survived the palette
// change, and the credentials block had no business being in the product at all.
definePageMeta({ layout: 'default' })
useSeoMeta({ title: 'Вход - Y.Map' })

const { isAuthenticated, login } = useAuth()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const error = ref('')
const needsVerification = ref(false)
const resending = ref(false)
const resent = ref(false)
const isLoading = ref(false)

// Already signed in -> go to profile (ТЗ 6.8). Route is client-only, so onMounted fires.
onMounted(() => {
  if (isAuthenticated.value) navigateTo('/profile')
})

const handleSubmit = async () => {
  isLoading.value = true
  error.value = ''
  needsVerification.value = false
  resent.value = false
  try {
    await login(email.value, password.value)
    await navigateTo('/profile')
  } catch (err: any) {
    if (err?.data?.code === 'EMAIL_NOT_VERIFIED') {
      needsVerification.value = true
      error.value = 'Адрес почты не подтверждён. Завершите регистрацию по ссылке из письма.'
    } else {
      error.value = err?.data?.message || 'Неверный адрес почты или пароль'
    }
  } finally {
    isLoading.value = false
  }
}

const resend = async () => {
  resending.value = true
  try {
    await auth.resendVerification(email.value)
    resent.value = true
    error.value = ''
    needsVerification.value = false
  } catch (err: any) {
    error.value = err?.data?.message || 'Не удалось отправить письмо'
  } finally {
    resending.value = false
  }
}
</script>
